var Spot = require('spot-framework');
var PageView = require('./base');
var templates = require('../templates');
var app = require('ampersand-app');
var csv = require('csv');

var DatasetCollectionView = require('./datasets/dataset-collection');

module.exports = PageView.extend({
  template: templates.datasets.page,
  initialize: function () {
    this.pageName = 'datasets';
  },
  events: {
    'change [data-hook~=json-upload-input]': 'uploadJSON',
    'change [data-hook~=csv-upload-input]': 'uploadCSV',
    'click [data-hook~=server-connect]': 'connectToServer',

    'input [data-hook~=dataset-selector]': 'input',
    'click [data-hook~=search-button]': 'search',
    'click [data-hook~=clear-button]': 'clear'
  },
  session: {
    needle: 'string',
    showSearch: 'boolean'
  },
  subviews: {
    datasets: {
      hook: 'dataset-items',
      constructor: DatasetCollectionView
    }
  },
  bindings: {
    'model.isLockedDown': {
      type: 'toggle',
      hook: 'add-datasets-div',
      invert: true
    },
    'showSearch': {
      type: 'toggle',
      hook: 'search-bar'
    },
    'needle': {
      type: 'value',
      hook: 'dataset-selector'
    }
  },
  input: function () {
    var select = this.el.querySelector('[data-hook~="dataset-selector"]');
    this.needle = select.value;

    this.update();
  },
  search: function () {
    this.showSearch = !this.showSearch;
    if (this.showSearch) {
      this.queryByHook('dataset-selector').focus();
    }
  },
  clear: function () {
    this.needle = '';
    this.update();
  },
  update: function () {
    // build regexp for searching
    try {
      var regexp = new RegExp(this.needle, 'i'); // case insensitive search

      // search through collection, check both name and description
      this.model.datasets.forEach(function (e) {
        var hay = e.name + e.URL + e.description;
        e.show = regexp.test(hay.toLowerCase());
      });
    } catch (error) {
    }
  },
  uploadJSON: function () {
    var fileLoader = this.queryByHook('json-upload-input');
    var uploadedFile = fileLoader.files[0];
    var reader = new window.FileReader();
    var dataURL = fileLoader.files[0].name;

    // TODO: enforce spot.driver === 'client'

    var dataset = app.me.datasets.add({
      name: dataURL,
      URL: dataURL,
      description: 'uploaded JSON file'
    });

    reader.onload = function (ev) {
      app.message({
        text: 'Processing',
        type: 'ok'
      });
      try {
        dataset.data = JSON.parse(ev.target.result);

        // automatically analyze dataset
        dataset.scan();
        dataset.facets.forEach(function (facet, i) {
          if (i < 20) {
            facet.isActive = true;

            if (facet.isCategorial) {
              facet.setCategories();
            } else if (facet.isContinuous || facet.isDatetime || facet.isDuration) {
              facet.setMinMax();
            }
          }
        });
        app.message({
          text: dataURL + ' was uploaded succesfully. Configured ' + dataset.facets.length + ' facets',
          type: 'ok'
        });
        window.componentHandler.upgradeDom();
      } catch (ev) {
        app.message({
          text: 'JSON file parsing problem! Please check the uploaded file.',
          type: 'error',
          error: ev
        });
      }
    };

    reader.onerror = function (ev) {
      app.message({
        text: 'File loading problem!',
        type: 'error',
        error: ev
      });
    };

    reader.onprogress = function (ev) {
      if (ev.lengthComputable) {
        // ev.loaded and ev.total are ProgressEvent properties
        var loaded = (ev.loaded / ev.total);
        if (loaded < 1) {
          app.message({
            text: 'Uploading file ' + (parseInt(loaded * 100)) + '%',
            type: 'ok'
          });
        }
      }
    };

    reader.readAsText(uploadedFile);
  },
  uploadCSV: function () {
    var fileLoader = this.queryByHook('csv-upload-input');
    var uploadedFile = fileLoader.files[0];
    var reader = new window.FileReader();
    var dataURL = fileLoader.files[0].name;

    // TODO: enforce spot.driver === 'client'

    var dataset = app.me.datasets.add({
      name: dataURL,
      URL: dataURL,
      description: 'uploaded CSV file'
    });

    reader.onload = function (ev) {
      app.message({
        text: 'Processing',
        type: 'ok'
      });
      var options = {
        columns: true, // treat first line as header with column names
        relax_column_count: false, // accept malformed lines
        comment: '' // Treat all the characters after this one as a comment.
      };

      csv.parse(ev.target.result, options, function (err, data) {
        if (err) {
          console.warn(err.message);
          app.message({
            text: 'CSV file parsing problem! Please check the uploaded file',
            type: 'error',
            error: ev
          });
        } else {
          dataset.data = data;

          // automatically analyze dataset
          dataset.scan();
          dataset.facets.forEach(function (facet, i) {
            if (i < 20) {
              facet.isActive = true;

              if (facet.isCategorial) {
                facet.setCategories();
              } else if (facet.isContinuous || facet.isDatetime || facet.isDuration) {
                facet.setMinMax();
              }
            }
          });
          app.message({
            text: dataURL + ' was uploaded succesfully. Configured ' + dataset.facets.length + ' facets',
            type: 'ok'
          });
          window.componentHandler.upgradeDom();
        }
      });
    };

    reader.onerror = function (ev) {
      console.warn('Error loading CSV file.', ev);
      app.message({
        text: 'File loading problem!',
        type: 'error'
      });
    };

    reader.onprogress = function (ev) {
      if (ev.lengthComputable) {
        // ev.loaded and ev.total are ProgressEvent properties
        var loaded = (ev.loaded / ev.total);
        if (loaded < 1) {
          app.message({
            text: 'Uploading file ' + (parseInt(loaded * 100)) + '%',
            type: 'ok'
          });
        }
      }
    };

    reader.readAsText(uploadedFile);
  },
  connectToServer: function () {
    app.me = new Spot({
      sessionType: 'server'
    });
    app.navigate('/');
    app.message({
      text: 'Connecting to server at ' + window.location.origin,
      type: 'ok'
    });

    app.me.isLockedDown = true;
    app.me.connectToServer();
    app.me.socket.emit('getDatasets');
  }
});
