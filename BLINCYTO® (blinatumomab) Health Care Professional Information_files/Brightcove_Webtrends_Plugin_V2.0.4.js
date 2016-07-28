//--------------------------------------------------------------------
// CLARK - Webtrends
// Webtrends Brightcove hybrid tracking plug-in
// for BrightCove Smart-Player (Cloud Player) and BrightCove Flash-Player
// Mod History
// 8/13/2011	     JCLARK    	Release candidate           v1.0.0
// 11/10/2013        JCLARK     updated for hybrid smart/flash player
//                              simplified  v2.0.0
// 12/17.2014        JCLARK     Updated hybrid version for latest API
//                              changed time to minutes from seconds (popular request)
//                              added config flag to select time in mins or secs
//                              added tracking callback
// 01/20/2014                   fixed config paramaters not being propagated into the plugin
// 03/12/2015                   updated for new smart player config in player V15.2
//
// Version 2.0.4
//--------------------------------------------------------------------
/*Configuration Options
 *
 * load: 			loaad event tracking valid values {true:false} default true
 * loadMeta: 	    loaadedmetadata event tracking valid values {true:false} default false
 * pause: 			pause/resume event tracking valid values {true:false} default true
 * quartile: 	    quartile event tracking valid values {true:false} default true
 * beacon: 		    beacon tracking valid values {true:false} default true
 * seek: 			seek event tracking valid values {true:false} default true
 * mute:            send mute events default:true
 * beaconRate:      the number of seconds between beacon in seconds values {0-65,000} default 30
 * pctInc: 		    percentage increments for quartile tracking default 25
 * volume: 		    volume event and level tracking valid values {true:false} default true
 * bins: 			bin range for duration tracking in seconds. valid values [0-65000{ defaut 15
 * menuEvents       send menu events default:false
 * cueEvents        send cue point events default: false
 * socialEvents     send social events default:false
 * menuEvents       send menu events default:false
 * adEvents         send ad events default:false
 * miscPlayerEvents send miscellaneous player events default:false
 * trackCallback    tracking callback to use instead of multitrack default: multitrack
 * timeType         minutes or seconds for the time measurers: default seconds
 *
 *    Parameter's generated
 *     clip_n: 					clip name
 *     clip_id: 				clip identifier
 *     clip_secs: 				playhead position in clip
 *     clip_ct: 				clip content (mp4,mov,avi,...)
 *     clip_perc: 				percentage played
 *     clip_ev: 				event identifier
 *     clip_duration: 		    clips duration in Minutes
 *     clip_t: 					player media type
 *     clip_player: 			clip player name
 *     clip_vol: 				clip volume level (0-100)
 *     clip_res: 				clip resolution hxw
 *     clip_duration_n: 	    clip duration bin
 *     clip_tv: 				clip tag version
 *     clip_mode: 				streaming or fixed duration
 *     dl: 						event type 41 - load, 40 for event
 *
 * ===============================================================================================
 * Notes:
 * for HTML5 tracking to work the following <param> must be added to the video object
 * <param name="includeAPI" value="true" />
 * <param name="templateLoadHandler" value="window.onTemplateLoad" />
 * <param name="templateReadyHandler" value="window.onTemplateReady('myExperience875524734001')" />
 * ===============================================================================================
 *
 * a smart-player implementation would looks like
 * <script src="http://admin.brightcove.com/js/BrightcoveExperiences.js"></script>
 * <object id="myExperience875524734001" class="BrightcoveExperience">
 *   <param name="bgcolor" value="#FFFFFF" />
 *   <param name="width" value="486" />
 *   <param name="height" value="412" />
 *   <param name="playerID" value="913708022001" />
 *   <param name="playerKey" value="AQ~~,AAAAB-1oZYk~,gUFOreLH78fno1yi8mVod7xpzwrUhbMr" />
 *   <param name="isVid" value="true" />
 *   <param name="dynamicStreaming" value="true" />
 *   <param name="includeAPI" value="true" />
 *   <param name="templateLoadHandler" value="window.onTemplateLoad" />
 *   <param name="templateReadyHandler" value="window.onTemplateReady('myExperience875524734001')" />
 *    <param name="@videoPlayer" value="875524734001" />
 *  </object>
 *
 * <!--
 * This script tag will cause the Brightcove Players defined above it to be created as soon
 * as the line is read by the browser. If you wish to have the player instantiated only after
 * the rest of the HTML is processed and the page load is complete, remove the line.
 * -->
 * <script type="text/javascript">brightcove.createExperiences();</script>
 */
function BCTrack(experienceID, p) {

    this.version = '2.0.4';
    var self = this;

    this.module = {
        bcExp: null,
        modExp: null,
        modCon: null,
        modVP: null,
        modAdv: null,
        modMen: null,
        modSoc: null,
        modCue: null
    };
    // configuration flags
    // set to false to disable tracking for specific events
    var config = {
        menuEvents: false,
        cueEvents: false,
        socialEvents: false,
        adEvents: false,
        expEvents: false,
        miscPlayerEvents: false,
        load: true,
        loadMeta: false,
        pause: true,
        quartile: true,
        beacon: true,
        seek: true,
        beaconRate: 30,
        pctInc: 25,
        volume: true,
        mute: true,
        bins: 15,
        dcsid: null,
        trackCallback: null
    };

    // overwrite the config value if they are specified on the plugin load line
    for (i in config) {
        if (typeof p[i] != 'undefined') config[i] = p[i]
    }

    this.data = {
        WT: {
            clip_n: null,
            clip_id: null,
            clip_secs: null,
            clip_ct: null,
            clip_perc: null,
            clip_ev: null,
            clip_duration: null,
            clip_t: null,
            clip_player: "BrightCove",
            clip_provider: null,
            clip_vol: null,
            clip_res: null,
            clip_player_res: null,
            clip_q: null,
            clip_duration_n: null,
            clip_tv: "2.0.3",
            clip_mode: 'Fixed Duration',
            dl: 40
        },
        _state: 0,
        _mute: false,
        _volSettle: -1,
        _seekSettle: 0,
        _loaded: false,
        _mediaPlay: false,
        _mediaSeek: false,
        _mediaBegin: false,
        _mediaComplete: false,
        _currentVolume: 1.00,
        _lastBeacon: 0,
        _lastQuartile: 0,
        _currentVideo: null,
        _experienceID: null,
        _PublisherID: null,
        _pauseTimer: null,
        _currentPhase: 'Content',
        _bound: false,
        _timeBase: 1
    };
    try {
        if (typeof config['timeType'] != 'undefined' && config['timeType'].toUpperCase() == 'MINS') this.data._timeBase = 60;
    } catch (err) {
    }
    //--------------------------------------------------------------------
    // EXPERIENCE EVENTS
    //--------------------------------------------------------------------
    this.Exp = {
        onExpEvent: function (evt) {
            if (evt.type == BCExperienceEvent.CONTENT_LOAD) {
                var vidInfo = self.module.modVP.getCurrentVideo();
                self.data.WT.clip_n = vidInfo.displayName;
                self.data.WT.clip_id = vidInfo.id;
                self.data.WT.clip_duration = Number((vidInfo.length / 1000) / self.data._timeBase).toFixed(2);
                for (c = 0; c < vidInfo.renditions.length; c++) {
                    if (vidInfo.renditions[c].encodingRate == vidInfo.encodingRate) {
                        self.data.WT.clip_res = vidInfo.renditions[c].frameHeight + 'x' + vidInfo.renditions[c].frameWidth;
                        self.data.WT.clip_t = vidInfo.renditions[c].videoCodec;
                        url = vidInfo.renditions[c].defaultURL.split('?')[0];
                        self.data.WT.clip_ct = url.split('.')[url.split('.').length - 1].toUpperCase().split('&')[0];
                    }
                }
                if (config.bins && isFinite(vidInfo.length)) {
                    var b = Math.floor((Math.floor(vidInfo.length / 1000) + config.bins) / config.bins);
                    self.data.WT.clip_duration_n = (b - 1) * config.bins + '-' + b * config.bins;
                }
                self._mediaComplete = false;
                self._lastQuartile = 0;
                self._lastBeacon = 0;

                if (config.load && !self.data._loaded) {
                    self.data.WT.clip_ev = 'load';
                    self.data.WT.dl = 41;
                    self.track.sendTag();
                    self.data.WT.dl = 40;
                }
                self.data._loaded = true;
            }
            self.data._PublisherID = self.module.modExp.getPublisherID();
            // if ready then send ready event
        }
    };
    //--------------------------------------------------------------------
    // PLAYER EVENTS
    //--------------------------------------------------------------------
    this.VP = {
        onPlayEvent: function (evt) {
            var data = self.data;
            data.WT.clip_perc = String(Math.floor((evt.position / evt.duration) * 100));
            if (data.WT.clip_perc > 100) data.WT.clip_perc = 100;
            if (evt.position > 0)
                data.WT.clip_secs = String(Number(evt.position / self.data._timeBase).toFixed(2));
            else data.WT.clip_secs = '0';
            if (data.WT.clip_n == null) {
                self.Exp.onExpEvent({type: BCExperienceEvent.CONTENT_LOAD });
            }

            switch (evt.type) {
                case BCMediaEvent.PLAY:
                    if (!data._mediaSeek) {
                        if (!data._mediaPlay) {
                            data._mediaPlay = true;
                            data._mediaSeek = false;
                            data._mediaComplete = false;
                            data._lastQuartile = 0;
                            data._lastBeacon = 0;
                            data.WT.clip_ev = 'Play';
                            self.track.sendTag();
                        } else {
                            if (config.pause) {
                                data.WT.clip_ev = 'Resume';
                                self.track.sendTag();
                            }

                            data._mediaPlay = false;

                        }
                    } else {
                        // seek resume
                        data._mediaSeek = false;
                    }
                    data._mediaComplete = false;
                    break;

                case BCMediaEvent.SEEK_NOTIFY:
                    //                case BCMediaEvent.SEEK:
                    data._mediaSeek = true;
                    if (config.seek) {
                        data.WT.clip_ev = 'Seek';
                        self.track.sendTag();
                        if (data._pauseTimer) {
                            clearTimeout(data._pauseTimer);
                            data.pauseTimer = null;
                        }
                    }
                    break;

                case BCMediaEvent.CHANGE:
                    data._mediaBegin = false;
                    data._mediaComplete = false;
                    var vidInfo = self.module.modVP.getCurrentVideo();
                    data.WT.clip_n = vidInfo.displayName;
                    data.WT.clip_id = vidInfo.id;
                    data.WT.clip_duration = Number((vidInfo.length / 1000) / self.data._timeBase).toFixed(2);
                    for (c = 0; c < vidInfo.renditions.length; c++) {
                        if (vidInfo.renditions[c].encodingRate == vidInfo.encodingRate) {
                            data.WT.clip_res = vidInfo.renditions[c].frameHeight + 'x' + vidInfo.renditions[c].frameWidth;
                            data.WT.clip_t = vidInfo.renditions[c].videoCodec;
                            url = vidInfo.renditions[c].defaultURL.split('?')[0];
                            data.WT.clip_ct = url.split('.')[url.split('.').length - 1].toUpperCase().split('&')[0];
                        }
                    }
                    if (config.bins && isFinite(vidInfo.length)) {
                        var b = Math.floor((Math.floor(vidInfo.length / 1000) + config.bins) / config.bins);
                        data.WT.clip_duration_n = (b - 1) * config.bins + '-' + b * config.bins;
                    }
                    data._lastQuartile = 0;
                    data._lastBeacon = 0;
                    break;

                case BCMediaEvent.BEGIN:
                    data._mediaBegin = true;
                    data._mediaComplete = false;
                    data.flag._lastQuartile = 0;
                    data._lastBeacon = 0;
                    break;

                case BCMediaEvent.PROGRESS:
                    if ((evt.position / evt.duration) > .98 && !data._mediaComplete) {
                        data._mediaComplete = true;
                        data.WT.clip_perc = 100;
                        data.WT.clip_ev = 'Complete';
                        self.track.sendTag();
                    }

                    if (config.beacon) {
                        if (evt.position > data._lastBeacon + config.beaconRate) {
                            data.WT.clip_ev = 'Beacon';
                            data._lastBeacon += config.beaconRate;
                            self.track.sendTag();
                        }
                    }

                    if (config.quartile) {
                        if (data.WT.clip_perc >= data._lastQuartile + config.pctInc) {
                            data.WT.clip_perc = Math.floor(data.WT.clip_perc / config.pctInc) * config.pctInc;
                            data.WT.clip_ev = 'Quartile';
                            data._lastQuartile += config.pctInc;
                            self.track.sendTag();
                        }
                    }
                    break;

                case BCMediaEvent.COMPLETE:
                    data._mediaBegin = false;
                    data._mediaPlay = false;
                    data._mediaComplete = true;
                    if (!data._mediaComplete) {
                        data.WT.clip_ev = 'Complete';
                        self.track.sendTag();
                    }
                    break;

                case BCMediaEvent.MUTE_CHANGE:
                    data._mute = (data._mute ? false : true);
                    if (config.mute && !data._mute) {
                        data.WT.clip_ev = 'Mute';
                        self.track.sendTag();
                    }
                    break;
                case BCMediaEvent.STOP:
                    if ((evt.position / evt.duration) < .98) {
                        if (!data._mediaComplete) {
                            if (config.pause) {
                                data._pauseTimer = setTimeout(function () {
                                    data.WT.clip_ev = 'Pause';
                                    self.track.sendTag();
                                }, 250);
                            }
                        } else {
                            // already paused
                        }
                    }
                    break;

                case BCMediaEvent.VOLUME_CHANGE:
                    if (self.module.modVP.getVolume() >= data._currentVolume * 1.1 || self.module.modVP.getVolume() <= data._currentVolume * .9) {
                        data._currentVolume = self.module.modVP.getVolume();
                        if (config.vol) {
                            data.WT.clip_ev = 'Volume';
                            self.track.sendTag();
                        }
                    }
                    break;

                default:
                    if (config.miscPlayerEvents) {
                        data.WT.clip_ev = evt.type;
                        self.track.sendTag();
                    }
            }
        }
    };

    //--------------------------------------------------------------------
    // Ad EVENTS
    //--------------------------------------------------------------------
    this.Ad = {
        onAdEvent: function (evt) {
            if (self.config.adEvents) {
                if (evt.type == BCAdvertisingEvent.AD_START) self.flag._currentPhase = 'PreRoll';
                if (evt.type == BCAdvertisingEvent.AD_COMPLETE) self.flag._currentPhase = 'Content';
                self.data.WT.clip_ev = evt.type;
                self.track.sendTag();
            }
        }
    };

    //--------------------------------------------------------------------
    // Menu EVENTS
    //--------------------------------------------------------------------
    this.Men = {
        onMenuEvent: function (evt) {
            if (self.config.menuEvents) {
                self.data.WT.clip_ev = evt.type;
                self.track.sendTag();
            }
        }
    };

    //--------------------------------------------------------------------
    // Social EVENTS
    //--------------------------------------------------------------------
    this.Soc = {
        onSocEvent: function (evt) {
            if (self.config.socialEvents) {
                self.data.WT.clip_ev = evt.type;
                self.track.sendTag();
            }
        }
    };

    //--------------------------------------------------------------------
    // Cue Point EVENTS
    //--------------------------------------------------------------------
    this.CueEvent = {
        onCue: function (evt) {
            if (self.config.cueEvents) {
                self.data.WT.clip_ev = evt.type;
                self.track.sendTag();
            }
        }
    };

    // this is the BrightCove init code that binds to all the player events
    this.data._experienceID = experienceID;

    // we need to figure out it they are using the lite (smart) or (all) player
    // depending on the platform a different call has to be used

    try {
        /* smart player*/
        this.module.bcExp = brightcove.api.getExperience(this.data._experienceID);
        module = brightcove.api.modules.APIModules;
        this.data.WT.clip_player = 'Brightcove-Smart';
    } catch (e) {
        // flash only player
        this.module.bcExp = brightcove.getExperience(this.data._experienceID);
        module = APIModules;
        this.data.WT.clip_player = 'Brightcove-Flash';
    }


    // legacy fallback
    try {
        // smart player
        this.module.modVP = this.module.bcExp.getModule(module.VIDEO_PLAYER);
    } catch (e) {
        // flash player
        this.module.bcExp = brightcove.getExperience(this.data._experienceID);
        module = APIModules;
        this.module.modVP = this.module.bcExp.getModule(module.VIDEO_PLAYER);
        this.data.WT.clip_player = 'Brightcove-Flash';
    }
    if (module.CONTENT) this.module.modCon = this.module.bcExp.getModule(module.CONTENT);
    if (module.ADVERTISING) this.module.modAdv = this.module.bcExp.getModule(module.ADVERTISING);
    if (module.MENU) this.module.modMen = this.module.bcExp.getModule(module.MENU);
    if (module.SOCIAL) this.module.modSoc = this.module.bcExp.getModule(module.SOCIAL);
    if (module.CUE_POINTS) this.module.modCue = this.module.bcExp.getModule(module.CUE_POINTS);
    if (module.EXPERIENCE) this.module.modExp = this.module.bcExp.getModule(module.EXPERIENCE);

    this.playerReady = function () {
        // we are putting these in try-catch blocks in case certain modules are not loaded
        // so we don't error -- getModule throws an exception of the module is not loaded
        var smartPlayer = false;
        if (typeof brightcove != 'undefined'
            && typeof brightcove.api != 'undefined'
            && typeof brightcove.api.events != 'undefined')
            smartPlayer = true;

        // player events
        var keys;
        var SmartPlayer;
        if (smartPlayer && typeof brightcove.api.events.MediaEvent != 'undefined') BCMediaEvent = brightcove.api.events.MediaEvent;
        if (typeof this.module.modVP != 'undefined' && typeof BCMediaEvent != 'undefined') {
            for (keys in BCMediaEvent) {
                this.module.modVP.addEventListener(BCMediaEvent[keys], this.VP.onPlayEvent, false);
            }
        }

        // EXPERIENCE EVENTS
        if (smartPlayer && typeof brightcove.api.events.ExperienceEvent != 'undefined') BCExperienceEvent = brightcove.api.events.ExperienceEvent;
        if (typeof this.module.modExp != 'undefined' && typeof BCExperienceEvent != 'undefined') {
            for (keys in BCExperienceEvent) {
                this.module.modExp.addEventListener(BCExperienceEvent[keys], this.Exp.onExpEvent, false);
            }
        }

        // CONTENT EVENTS
        if (smartPlayer && typeof brightcove.api.events.ContentEvent != 'undefined') BCContentEvent = brightcove.api.events.ContentEvent;
        if (typeof this.module.modCon != 'undefined' && typeof BCContentEvent != 'undefined') {
            for (keys in BCContentEvent) {
                this.module.modCon.addEventListener(BCContentEvent[keys], this.Exp.onExpEvent, false);
            }
        }

        // Ad events
        if (smartPlayer && typeof brightcove.api.events.AdvertisingEvent != 'undefined') BCAdvertisingEvent = brightcove.api.events.AdvertisingEvent;
        if (typeof this.module.modAdv != 'undefined' && typeof BCAdvertisingEvent != 'undefined') {
            for (keys in BCAdvertisingEvent) {
                this.module.modAdv.addEventListener(BCAdvertisingEvent[keys], this.Ad.onAdEvent, false);
            }
        }

        // Menu events
        if (smartPlayer && typeof brightcove.api.events.MenuEvent != 'undefined') BCMenuEvent = brightcove.api.events.MenuEvent;
        if (typeof this.module.modMen != 'undefined' && typeof BCMenuEvent != 'undefined') {
            for (keys in BCMenuEvent) {
                this.module.modMen.addEventListener(BCMenuEvent[keys], this.Men.onMenuEvent, false);
            }
        }

        // Social events
        if (smartPlayer && typeof brightcove.api.events.SocialEvent != 'undefined') BCSocialEvent = brightcove.api.events.SocialEvent;
        if (typeof this.module.modSoc != 'undefined' && typeof BCSocialEvent != 'undefined') {
            for (keys in BCSocialEvent) {
                this.module.modSoc.addEventListener(BCSocialEvent[keys], this.Soc.onSoc, false);
            }
        }

        // CuePoint Events
        if (smartPlayer && typeof brightcove.api.events.CuePointEvent != 'undefined') BCCuePointEvent = brightcove.api.events.CuePointEvent;

        if (typeof this.module.modCue != 'undefined' && typeof BCCuePointEvent != 'undefined') {
            this.module.modCue.addEventListener(BCCuePointEvent.CUE, this.CueEvent.onCue, false);
        }
        // try the smart player callback and then the flash player call
        var vidInfo = this.module.modVP.getCurrentVideo(function (vidInfo) {
            self.setMeta.dataMeta(self, vidInfo);
        });
        if (typeof vidInfo != 'undefined') {
            this.setMeta.dataMeta(this, vidInfo);
        }
        this.data._bound = true;
    };
// this is set up as a queue so its v9 tag compatible in case we need to regress the solution

    this.setMeta = {
        dataMeta: function (obj, vidInfo) {
            obj.data.WT.clip_n = vidInfo.displayName;
            obj.data.WT.clip_id = vidInfo.id;
            obj.data.WT.clip_duration = Number((vidInfo.length / 1000) / obj.data._timeBase).toFixed(2);

            // default it 0 if renditions are not enabled
            obj.data.WT.clip_res = vidInfo.renditions[0].frameHeight + 'x' + vidInfo.renditions[0].frameWidth;
            obj.data.WT.clip_t = vidInfo.renditions[0].videoCodec;
            url = vidInfo.renditions[0].defaultURL.split('?')[0];
            obj.data.WT.clip_ct = url.split('.')[url.split('.').length - 1].toUpperCase();

            r = self.module.modVP.getCurrentRendition(function (rend) {
                if (rend != null) {
                    self.data.WT.clip_res = rend.frameHeight + 'x' + rend.frameWidth;
                    self.data.WT.clip_t = rend.videoCodec;
                    url = rend.defaultURL.split('?')[0];
                    self.data.WT.clip_ct = url.split('.')[url.split('.').length - 1].toUpperCase();
                }
            });
            if (typeof r != 'undefined') {
                obj.data.WT.clip_res = r.frameHeight + 'x' + r.frameWidth;
                obj.data.WT.clip_t = r.videoCodec;
                url = r.defaultURL.split('?')[0];
                obj.data.WT.clip_ct = url.split('.')[url.split('.').length - 1].toUpperCase();
            }
            if (config.bins && isFinite(vidInfo.length)) {
                var b = Math.floor((Math.floor(vidInfo.length / 1000) + config.bins) / config.bins);
                obj.data.WT.clip_duration_n = (b - 1) * config.bins + '-' + b * config.bins;
            }

            // init the tracking flags
            this._mediaComplete = false;
            this._lastQuartile = 0;
            this._lastBeacon = 0;
            if (config.load) {
                obj.data.WT.clip_ev = 'Load';
                obj.data.WT.dl = 41;
                obj.track.sendTag();
                obj.data.WT.dl = 40;
            }
            if (config.loadMeta) {
                obj.data.WT.clip_ev = 'LoadMeta';
                obj.track.sendTag();
            }

        }

    };
    this.track = {
        sendTag: function () {
            if (typeof config.trackCallback == 'function') {
                config.trackCallback(self);
            } else {
                var tags = [];
                var cache = [];

                for (var tag in self.data.WT) {
                    tags.push('WT.' + tag);
                    tags.push(self.data.WT[tag]);
                }
                cache.push({
                    element: this,
                    argsa: tags
                });
                if (typeof Webtrends != 'undefined') {
                    Webtrends.multiTrack(cache.pop());
                }
            }
        }
    }
}

Init = function (t, p) {
    try {
        //
        // this code block really should bot be used ans the APIModules_all "should" be
        // loaded with the BrightCoveExperiances scripts in the page markup per BrightCove's spece
        // this async load 'may' work for some clients but its NOT the preferend method
        // the script should be loaded in the page markup
        //
        var smartPlayer = false;
        if (typeof brightcove != 'undefined'
            && typeof brightcove.api != 'undefined'
            && typeof brightcove.api.events != 'undefined')
            smartPlayer = true;
        if (typeof p['loadAPI'] != 'undefined' && p['loadAPI'] == true) {
            if (!smartPlayer) {
                //load the API module if its not loaded
                if (typeof APIModules == 'undefined') {
                    var s = document.createElement('script');
                    s.async = false;
                    s.type = "text/javascript";
                    s.src = "//admin.brightcove.com/js/APIModules_all.js";
                    var s2 = document.getElementsByTagName("script")[0];
                    s2.parentNode.insertBefore(s, s2);
                }
            }
        }

        // map to the BC experience
        BrightcoveWebtrends = [];

        // bind to each object only once or we'll get multiple events sent
        // this is for the situation where there is more than one player on a page

        // smart player API
        // change the function name to reflect the onReady handler in the param settlement
        //
        // this is executed for flash players where the user does not define the event parameters
        // its a fall-back tracking bind
        //  ie. <param name="templateLoadHandler" value="window.onTemplateLoad" />
        //      <param name="templateReadyHandler" value="window.onTemplateReady" />

        window.onTemplateReady = function (e) {
            if (typeof e == "string") {
                BrightcoveWebtrends[e].playerReady();
            } else {
                var experienceID = e.target.experience.id;
                BrightcoveWebtrends[experienceID] = new BCTrack(experienceID, p);
                BrightcoveWebtrends[Webtrends.experienceID].playerReady();
            }
        };

        window.onTemplateLoaded = function (experienceID) {

            if (typeof BrightcoveWebtrends[experienceID] == 'undefined') {
                BrightcoveWebtrends[experienceID] = new BCTrack(experienceID, p);
                if (!smartPlayer) BrightcoveWebtrends[experienceID].playerReady();
            }
        };

        if (typeof wt_bc_experienceID != 'undefined') {
            BrightcoveWebtrends[wt_bc_experienceID] = new BCTrack(wt_bc_experienceID, p);
            if (!smartPlayer) BrightcoveWebtrends[wt_bc_experienceID].playerReady();
        }
    } catch (e) {
    }
};
Webtrends.registerPlugin('BrightCove', Init);
