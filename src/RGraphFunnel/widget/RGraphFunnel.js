/*global logger */
/*
    DRGraph Funnel Chart
    ========================

    @file      : RGraphFunnel.js
    @version   : 1.0.0
    @author    : Ivo Sturm
    @date      : 09-02-2017
    @copyright : First Consulting
    @license   : Apache 2

    Documentation
    ========================
    Add a Funnel chart based on the RGraph library to your application. 
*/

// Required module list. 
define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dijit/_TemplatedMixin",
    "mxui/dom",
    "dojo/dom",
	"dojo/on",
    "dojo/dom-style",
    "dojo/_base/array",
    "dojo/_base/lang",
	"dojo/text",
    "dojo/text!RGraphFunnel/widget/template/RGraphFunnel.html",
    "RGraphFunnel/lib/RGraph.common.core",
	"RGraphFunnel/lib/RGraph.common.dynamic",
	"RGraphFunnel/lib/RGraph.common.tooltips",
	"RGraphFunnel/lib/RGraph.common.zoom",
	"RGraphFunnel/lib/RGraph.funnel"
], function(declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, on, dojoStyle, dojoArray, dojoLang, dojoText, widgetTemplate) {
    "use strict";
    // Declare widget's prototype.
    return declare("RGraphFunnel.widget.RGraphFunnel", [ _WidgetBase, _TemplatedMixin ], {
        // _TemplatedMixin will create our dom node using this HTML template.
        templateString: widgetTemplate,

        // DOM elements
        RGraphFunnel: null,
		cvs: null,

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handles: null,
        _contextObj: null,
		_progressID: null,
		_funnel: null,
		_data: [],
		_labels: [],
		_colors: [],
		_guids: [],
		_options: {},
		_logNode: 'RGraphFunnel: ',

        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function() {

            logger.debug(this.id + ".constructor");
            this._handles = [];
        },

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        postCreate: function() {
            logger.debug(this.id + ".postCreate");
			this._hideProgress();

			this.RGraphFunnel.firstChild.nextSibling.style.cursor = 'pointer';	
			
			// set dimensions based on widget settings
			this.cvs.width = this.funnelWidth;
			this.cvs.height = this.funnelHeight;
						
        },

		resize: function(){

			// when resize is triggered (also after postCreate) size the canvas
			if(this._funnel){
				RGraph.redraw();
				console.log(this._logNode + 'resizing to width, height: ' + this.funnelWidth + "px, " + this.funnelHeight + 'px.');
			}
		},
        // mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
        update: function(obj, callback) {
			
            logger.debug(this.id + ".update");
			this._hideProgress();
            this._contextObj = obj;
			
            this._resetSubscriptions();
            this._updateRendering();

            if (typeof callback !== "undefined") {
              callback();
            }
        },

        // mxui.widget._WidgetBase.uninitialize is called when the widget is destroyed. Implement to do special tear-down work.
        uninitialize: function() {
            // Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
			this._hideProgress();

        },
        _drawChart: function(slices) {
			
			// populate arrays based on Get Slices microflow objectdata for reference later on
			for (var i = 0; i < slices.length; i++){
				var value = slices[i].get(this.valueAttr);
				var label = slices[i].get(this.labelAttr);
				var color = slices[i].get(this.colorAttr);
				var guid = slices[i].getGuid();
				this._data.push(value);
				this._labels.push(label + ": " + value);
				this._colors.push(color);
				this._guids.push(guid);
				
			}
			// set appearance options based on Modeler widget settings
			this._options = {
				gutterRight: this.gutterRight,
				gutterLeft: this.gutterLeft,
				gutterBottom: this.gutterBottom,
				gutterTop: this.gutterTop,
				textBoxed: this.textBoxed,
				width: this.funnelWidth,
				height: this.funnelHeight,
				shadow: this.shadow,
				shadowColor: this.shadowColor,
				shadowBlur: this.shadowBlur,
				shadowOffsetx: 5,
				shadowOffsety: 5,
				textFont:this.textFont,
				textColor:this.textColor,
				textSize:this.textSize,
				labels: this._labels,
				colors: this._colors,
				tooltips: this._labels,
				tooltipsEvent: 'onmousemove',
				crosshairs: false,
				labelsX: 10,
				labelsSticks: this.labelsSticks,
				strokestyle: 'rgba(0,0,0,0)',
				textAccessible: true
			};
			// create funnel canvas
			this._funnel = new RGraph.Funnel({
				id: this.cvs.id,
				data: this._data,
				options: this._options
			});
			
			// eventsClick option does not work, hence use this
			this._funnel.set({
				eventsClick: dojoLang.hitch(this,function (e, shape) {
					this._execMF(this.onClickMF,this._guids[shape.index]);
				}),
				// by returning a truthy value from the handler function this allows us to change the cursor to pointer when the mouse is moved over a bar. Because this is a common operation the pointer is automatically changed back to the previous state when it is moved away from the bar.
				eventsMousemove: dojoLang.hitch(this,function (e, shape) {
					return true;
				})
			});	
			// draw the funnel with RGraph API
			this._funnel.draw();

			// hide progressbar
			this._hideProgress();

        },

        // Rerender the interface.
        _updateRendering: function() {
            logger.debug(this.id + "._updateRendering");

            // Draw or reload.
            if (this._contextObj !== null) {
				this._showProgress();
				this._loadTreeData();
            } else {
                dojoStyle.set(this.domNode, "display", "none"); // Hide widget dom node.
            }

        },
		_loadTreeData : function () {
			if (this.sliceMicroflow){
				// get slice list from microflow
				mx.ui.action(this.sliceMicroflow,{
					params: {
						applyto: 'selection',
						guids: [this._contextObj.getGuid()]
					},
					callback:  dojoLang.hitch(this,function(result) {
						this._drawChart(result);
					}),	
					error: dojoLang.hitch(this,function(error) {
						this._hideProgress();
						console.log(error.description);
					})
				}, this);
			} else {
				// if no microflow configured, give console error in browser to notify of missing setting
				console.error(this._logNode + 'please select a microflow to get the slices for the funnel chart');
			}

       },
      // Reset subscriptions.
        _resetSubscriptions: function () {
            logger.debug(this.id + "._resetSubscriptions");

            var _objectHandle = null;

            // Release handles on previous object, if any.
            if (this._handles) {
                dojoArray.forEach(this._handles, function (handle, i) {
                    mx.data.unsubscribe(handle);
                });
                this._handles = [];
            }

            // When a mendix object exists create subscribtions.
            if (this._contextObj) {
                _objectHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: dojoLang.hitch(this, function (guid) {
                        this._updateRendering();
                    })
                });


                this._handles = [_objectHandle];
            }
			
        },
		_showProgress: function () {
			this._progressID = mx.ui.showProgress();
		},
		_hideProgress: function () {
			if (this._progressID){
				mx.ui.hideProgress(this._progressID);
				this._progressID = null;
			}
		},
			
		_execMF: function (mf, guid, cb) {
			if (mf && guid) {
				this._progressID = mx.ui.showProgress();
				mx.ui.action(this.onClickMF,{
							params:	{
								applyto: 'selection',
								guids: [guid]

							},
							progress: "modal",
							origin: this.mxform,
							error: dojoLang.hitch(this,function(error) {
								console.log(error.description);
								console.log(guid);
								this._hideProgress();
							}),
							callback: dojoLang.hitch(this,function(result){	
								this._hideProgress();
							})						
				},this);
			}
		},

    });
});

require(["RGraphFunnel/widget/RGraphFunnel"], function() {
    "use strict";
});
