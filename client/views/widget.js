var View = require('ampersand-view');
var templates = require('../templates');
var app = require('ampersand-app');

var filterItemView = View.extend({
    template: '<option data-hook="item"></option>',
    bindings: {
        'model.name': {
            type: 'text',
            hook: 'item',
        },
        'model.active': {
            type: 'toggle',
            hook: 'item',
        },
        'model.id': {
            type: 'value',
            hook: 'item',
        },
    },
});

module.exports = View.extend({
    template: templates.includes.widget,
    initialize: function (options) {
        this.collection = app.filters;
    },
    events: {
        'click [data-hook~="close"]': 'closeWidget',
        'change [data-hook~="filter-selector"]': 'changeFilter',
        'change [data-hook~="secondary-selector"]': 'changeSecondary',
    },
    closeWidget: function () {
        this.model.trigger( 'removeWidget', this.model );
        this.remove();
    },
    changeFilter:  function (e) {
        var select = this.el.querySelector('[data-hook~="filter-selector"]');
        this.model.filter = select.options[select.selectedIndex].value;

        this.renderContent(this);
    },
    changeSecondary:  function (e) {
        var select = this.el.querySelector('[data-hook~="secondary-selector"]');
        this.model.secondary = select.options[select.selectedIndex].value;

        this.renderContent(this);
    },
    render: function() {
        this.renderWithTemplate(this);
        this.renderCollection(this.collection, 
                              filterItemView,
                              this.queryByHook('filter-selector'),
                              {filter: function (f) {return f.active;}});


        var select = this.el.querySelector('select');
        select.value = this.model.filter;

        if(this.model.secondary) {
            this.renderCollection(this.collection, 
                                  filterItemView,
                                  this.queryByHook('secondary-selector'),
                                  {filter: function (f) {return f.active;}});

            select = this.queryByHook('secondary-selector'); // FIXME does not select the right thing
            select.value = this.model.secondary;
        }

        return this;
    },
    renderContent: function (view) {
        // Propagate to subview
        view.widget.renderContent(view.widget);
    },
    subviews: {
        widget: {
            hook: 'widget',
            constructor: function(options) {
                options.type = options.parent.model.type;
                options.model = options.parent.model;

                return app.widgetFactory.newView(options.parent.model.type, options);
            },
        },
    },
});
