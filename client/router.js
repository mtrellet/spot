var app = require('ampersand-app');
var Router = require('ampersand-router');
var HomePage = require('./pages/home');
var FacetsPage = require('./pages/facets');
var AnalyzePage = require('./pages/analyze');


module.exports = Router.extend({
    routes: {
        '': 'home',
        'home':    'home',
        'facets': 'facets',
        'analyze': 'analyze',
        '(*path)': 'catchAll'
    },

    // ------- ROUTE HANDLERS ---------
    home: function () {
        app.trigger('page', new HomePage({
            model: app.me
        }));
    },

    facets: function () {
        app.trigger('page', new FacetsPage({
            model: app.me,
            collection: app.filters
        }));
    },

    analyze: function () {
        app.trigger('page', new AnalyzePage({
            model: app.me
        }));
    },

    catchAll: function () {
        this.redirectTo('');
    }
});
