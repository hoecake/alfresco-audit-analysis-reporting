/**
 * Copyright (C) 2015-2015 Francesco Corti.
 *
 * You should have received a copy of the GNU Lesser General Public License.
 * If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Dashboard AAAR component.
 *
 * @namespace FCorti.dashlet
 * @class Alfresco.dashlet.AAAR
 */
(function()
{
   /**
    * YUI Library aliases
    */
   var Dom = YAHOO.util.Dom,
       Event = YAHOO.util.Event,
       Selector = YAHOO.util.Selector;

   /**
    * Alfresco Slingshot aliases
    */
   var $html = Alfresco.util.encodeHTML,
       $links = Alfresco.util.activateLinks;

   /**
    * Dashboard AAAR constructor.
    *
    * @param {String} htmlId The HTML id of the parent element
    * @return {Alfresco.dashlet.AAAR} The new component instance
    * @constructor
    */
   Alfresco.dashlet.AAAR = function AAAR_constructor(htmlId)
   {
      Alfresco.dashlet.AAAR.superclass.constructor.call(this, "Alfresco.dashlet.AAAR", htmlId, ["datasource", "datatable", "animation"]);

      // Initialise prototype properties
      this.sites = [];

      // Services
      this.services.preferences = new Alfresco.service.Preferences();

      return this;
   };

   YAHOO.extend(Alfresco.dashlet.AAAR, Alfresco.component.Base,
   {
      /**
       * Preferences
       */
      PREFERENCES_AAAR_DASHLET: "",
      PREFERENCES_AAAR_DASHLET_FILTER: "",

      /**
       * Analytics data
       *
       * @property analytics
       * @type array
       */
      analytics: [],

      /**
       * Selected filter value
       * 
       * @property filter
       * @type String
       */
      filter: null,

      /**
       * Object container for initialization options
       *
       * @property options
       * @type object
       */
      options:
      {
         /**
          * List of valid filters
          *
          * @property validFilters
          * @type object
          */
         validFilters:
         {
            "all": true,
            "dashboards": true,
            "reports": true,
            "freeAnalysis": true
         },

         /**
          * Array of analytics
          *
          * @property analytics
          * @type array of objects
          * @default []
          */
         analytics: [],
      },

      /**
       * Fired by YUI when parent element is available for scripting
       * @method onReady
       */
      onReady: function AAAR_onReady()
      {
         var me = this;

         // Fetch preferences
         this.PREFERENCES_AAAR_DASHLET = this.services.preferences.getDashletId(this, "aaar");
         this.PREFERENCES_AAAR_DASHLET_FILTER = this.PREFERENCES_AAAR_DASHLET + ".filter";

         // Create Dropdown filter
         this.widgets.type = Alfresco.util.createYUIButton(
            this, 
            "type", 
            this.onTypeFilterChanged, 
            { type: "menu", menu: "type-menu", lazyloadmenu: false });

         // DataSource definition
         this.widgets.dataSource = new YAHOO.util.DataSource(
            this.analytics,
            { responseType: YAHOO.util.DataSource.TYPE_JSARRAY });

         // DataTable column defintions
         var columnDefinitions =
            [
               { key: "icon", label: "Icon", sortable: false, formatter: this.bind(this.renderCellIcon), width: 26 },
               { key: "detail", label: "Description", sortable: false, formatter: this.bind(this.renderCellDetail) },
               { key: "actions", label: "Actions", sortable: false, formatter: this.bind(this.renderCellActions), width: 24 }
            ];

         // DataTable definition
         this.widgets.dataTable = new YAHOO.widget.DataTable( 
            this.id + "-aaar", 
            columnDefinitions, 
            this.widgets.dataSource,
            { MSG_EMPTY: this.msg("message.datatable.loading") });

         // Enable row highlighting
         this.widgets.dataTable.subscribe("rowMouseoverEvent", this.widgets.dataTable.onEventHighlightRow);
         this.widgets.dataTable.subscribe("rowMouseoutEvent", this.widgets.dataTable.onEventUnhighlightRow);

         // Load sites & preferences
         this.initPreferences();
         this.loadSites();
      },

      /**
       * Date drop-down changed event handler
       *
       * @method onTypeFilterChanged
       * @param p_sType {string} The event
       * @param p_aArgs {array}
       */
      onTypeFilterChanged: function AAAR_onTypeFilterChanged(p_sType, p_aArgs)
      {
         var menuItem = p_aArgs[1];
         if (menuItem)
         {
            this.widgets.type.set("label", menuItem.cfg.getProperty("text") + " " + Alfresco.constants.MENU_ARROW_SYMBOL);
            this.widgets.type.value = menuItem.value;

            // Save preferences
            this.services.preferences.set(this.PREFERENCES_AAAR_DASHLET_FILTER, menuItem.value,
            {
               successCallback:
               {
                  fn: function() 
                  {
                     // Update local cached copy of current filter
                     this.filter = menuItem.value;

                     // Reload the sites list
                     this.loadSites();
                  },
                  scope: this
               }
            });
         }
      },

      /**
       * Init cached state from User Preferences
       *
       * @method initPreferences
       */
      initPreferences: function AAAR_initPreferences()
      {
         var prefs = this.services.preferences.get();

         // Retrieve the preferred filter for the UI
         var filter = Alfresco.util.findValueByDotNotation(prefs, this.PREFERENCES_AAAR_DASHLET_FILTER, "all");
         this.filter = this.options.validFilters.hasOwnProperty(filter) ? filter : "all";
      },

      /**
       * Load analytic list
       *
       * @method loadSites
       */
      loadSites: function AAAR_loadSites()
      {
         // Select the preferred filter in the ui
         this.widgets.type.set("label", this.msg("AAAR.dashlet.analytics.filter." + this.filter) + " " + Alfresco.constants.MENU_ARROW_SYMBOL);
         this.widgets.type.value = this.filter;

         // Display the toolbar now that we have selected the filter
         Dom.removeClass(Selector.query(".toolbar div", this.id, true), "hidden");

         // Filter the analytics from the complete list.
         this.analytics = [];
         var ii = 0;
         for (var i = 0; i < this.options.analytics.length; ++i)
         {
            if (this.filter == "all" || this.filter == this.options.analytics[i].type)
            {
               /* TODO: Develop the selection depending on the user/group of the connected user. */
               this.analytics[ii++] = this.options.analytics[i];
            }
         }

         var successHandler = function AAAR_onAnalyticsUpdate_success(sRequest, oResponse, oPayload)
         {
            var desc = '<p align="center">';
            desc += '<br/>';
            desc += '<img src="' + Alfresco.constants.URL_RESCONTEXT + 'components/images/help-tutorial-64.png" title="' + this.msg("AAAR.dashlet.analytics.filter.noResult") + '" />';
            desc += '<br/>';
            desc += '<h3 align="center">' + this.msg("AAAR.dashlet.analytics.filter.noResult") + '</h3>';
            desc += '</p>';

            oResponse.results = this.analytics;
            this.widgets.dataTable.set("MSG_EMPTY", desc);
            this.widgets.dataTable.onDataReturnInitializeTable.call(this.widgets.dataTable, sRequest, oResponse, oPayload);
         };

         // Update the widget.
         this.widgets.dataSource.sendRequest(
            this.analytics,
            { success: successHandler, scope: this });
      },

      /**
       * Icon custom datacell formatter
       *
       * @method renderCellIcon
       * @param elCell {object}
       * @param oRecord {object}
       * @param oColumn {object}
       * @param oData {object|string}
       */
      renderCellIcon: function AAAR_renderCellIcon(elCell, oRecord, oColumn, oData)
      {
         Dom.setStyle(elCell, "width", oColumn.width + "px");
         Dom.setStyle(elCell.parentNode, "width", oColumn.width + "px");

         var analytics = oRecord.getData(),
             img = (analytics.icon == null || analytics.icon == "")  ? "task-16.png" :  analytics.icon;

         elCell.innerHTML = '<img src="' + Alfresco.constants.URL_RESCONTEXT + 'components/images/' + img + '" title="' + analytics.type + '" />';
      },

      /**
       * Name & description custom datacell formatter
       *
       * @method renderCellDetail
       * @param elCell {object}
       * @param oRecord {object}
       * @param oColumn {object}
       * @param oData {object|string}
       */
      renderCellDetail: function AAAR_renderCellDetail(elCell, oRecord, oColumn, oData)
      {
         var analytics = oRecord.getData(),
             desc = "";

         desc += '<h3 class="faded">';
         desc += (analytics.url && analytics.url != "") ? '<a href="' + analytics.url + '" title="' + this.msg("AAAR.dashlet.analytics.link") + '" class="theme-color-1" target="_blank">' : "";
         desc += (analytics.label && analytics.label != "") ? $html(this.msg(analytics.label)) : $html(this.msg("details.description.none"));
         desc += (analytics.url && analytics.url != "") ? '</a>' : "";
         desc += '</h3>';

         elCell.innerHTML = desc;
      },

      /**
       * Actions custom datacell formatter
       *
       * @method renderCellActions
       * @param elCell {object}
       * @param oRecord {object}
       * @param oColumn {object}
       * @param oData {object|string}
       */
      renderCellActions: function AAAR_renderCellActions(elCell, oRecord, oColumn, oData)
      {
         Dom.setStyle(elCell, "width", oColumn.width + "px");
         Dom.setStyle(elCell.parentNode, "width", oColumn.width + "px");

         var analytics = oRecord.getData(),
             desc = "";

         desc += (analytics.url && analytics.url != "") ? '<a href="' + analytics.url + '" class="link-analytics" title="' + this.msg("AAAR.dashlet.analytics.link") + '" target="_blank">&nbsp;</a>' : "";

         elCell.innerHTML = desc;
      },

   });

})();
