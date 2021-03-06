var BaseChart = require('./base-chart');
var moment = require('moment-timezone');

function ttLabel (tooltip, data) {
  var point = data.datasets[tooltip.datasetIndex].data[tooltip.index];
  var axes = data.datasets[0].spotAxes;

  var label = [
    axes.x + ': ' + point.a,
    axes.y + ': ' + point.b
  ];
  if (axes.r) {
    label.push('radius (' + axes.r + ') ' + point.bb);
  }
  if (axes.c) {
    label.push('color (' + axes.c + ' ) ' + point.aa);
  }
  label.push('Number of points in bin ' + point.count);
  return label;
}

module.exports = BaseChart.extend({
  initialize: function () {
    this.slots.reset([
      {
        description: 'X axis',
        type: 'partition',
        rank: 1,
        required: true,
        supportedFacets: ['categorial', 'datetime', 'duration', 'continuous', 'text']
      },
      {
        description: 'Y axis',
        type: 'partition',
        rank: 2,
        required: true,
        supportedFacets: ['categorial', 'datetime', 'duration', 'continuous', 'text']
      },
      {
        description: 'Point color',
        type: 'aggregate',
        rank: 1,
        required: false,
        supportedFacets: ['continuous', 'duration']
      },
      {
        description: 'Point size',
        type: 'aggregate',
        rank: 2,
        required: false,
        supportedFacets: ['continuous', 'duration']
      },
      {
        description: 'X error',
        type: 'aggregate',
        rank: 3,
        required: false,
        supportedFacets: ['continuous', 'duration']
      },
      {
        description: 'Y error',
        type: 'aggregate',
        rank: 4,
        required: false,
        supportedFacets: ['continuous', 'duration']
      }
    ]);
  },
  chartjsConfig: function () {
    return {
      type: 'bubbleError',
      data: {
        datasets: []
      },
      options: {
        animation: false,
        title: {
          display: true,
          position: 'top'
        },
        legend: {
          display: false
        },
        scales: {
          xAxes: [{
            type: 'linear',
            position: 'bottom',
            gridLines: {
              zeroLineColor: 'rgba(0,255,0,1)'
            },
            scaleLabel: {
              display: true
            },
            time: {
              parser: function (label) {
                return moment(label, moment.ISO_8601);
              }
            }
          }],
          yAxes: [{
            type: 'linear',
            position: 'left',
            gridLines: {
              zeroLineColor: 'rgba(0,255,0,1)'
            },
            scaleLabel: {
              display: true
            },
            time: {
              parser: function (label) {
                return moment(label, moment.ISO_8601);
              }
            }
          }]
        },
        tooltips: {
          enabled: true,
          mode: 'single',
          callbacks: {
            label: ttLabel
          }
        }
      }
    };
  }
});
