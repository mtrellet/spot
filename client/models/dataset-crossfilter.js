/*
 * A dataset backed by Crossfilter, ie. fully client side filtering without the need for a server or database.
 * @module client/dataset-crossfilter
 */
var Dataset = require('./dataset');
var Facet = require('./facet');

var utildx = require('../util-crossfilter');
var misval = require('../misval');

/*
 * Crossfilter instance, see [here](http://square.github.io/crossfilter/)
 * @memberof! Dataset
 */
var crossfilter = require('crossfilter')([]);

/*
 * setMinMax sets the range of a continuous or time facet
 * @memberof! Dataset
 * @param {Dataset} dataset
 * @param {Facet} facet
 * @param (boolean} transformed take range after (true) or before (false) transformation
 */
function setMinMax (dataset, facet, transformed) {
  var fn;
  if (transformed) {
    fn = utildx.valueFn(facet);
  } else {
    fn = utildx.baseValueFn(facet);
  }

  var group = dataset.crossfilter.groupAll();

  var takeMin;
  var takeMax;
  if (facet.displayContinuous) {
    takeMin = function (a, b) {
      if (b === misval || a < b) {
        return a;
      }
      return b;
    };
    takeMax = function (a, b) {
      if (b === misval || a > b) {
        return a;
      }
      return b;
    };
  } else if (facet.displayDatetime) {
    takeMin = function (a, b) {
      if (b === misval || a.isBefore(b)) {
        return a;
      } else {
        return b;
      }
    };
    takeMax = function (a, b) {
      if (b === misval || b.isBefore(a)) {
        return a;
      } else {
        return b;
      }
    };
  }

  group.reduce(
    function (p, d) { // add
      var v = fn(d);
      if (v !== misval) {
        p.min = takeMin(v, p.min);
        p.max = takeMax(v, p.max);
      }
      return p;
    },
    function (p, v) { // subtract
      return p;
    },
    function () { // initialize
      return {
        min: misval,
        max: misval
      };
    }
  );

  if (facet.displayDatetime) {
    var start = group.value().min;
    var end = group.value().max;
    var humanized = end.from(start, true).split(' ');
    var units = humanized[humanized.length - 1];

    if (units === 'minute') {
      units = 'seconds';
    } else if (units === 'hour') {
      units = 'minutes';
    } else if (units === 'day') {
      units = 'hours';
    } else if (units === 'week') {
      units = 'days';
    } else if (units === 'month') {
      units = 'days';
    } else if (units === 'year') {
      units = 'months';
    }

    var fmt;
    if (units === 'seconds') {
      fmt = 'mm:ss';
    } else if (units === 'minutes') {
      fmt = 'HH:mm';
    } else if (units === 'hours') {
      fmt = 'HH:00';
    } else if (units === 'days') {
      fmt = 'dddd do';
    } else if (units === 'weeks') {
      fmt = 'wo';
    } else if (units === 'months') {
      fmt = 'YY MMM';
    } else if (units === 'years') {
      fmt = 'YYYY';
    }

    facet.minvalAsText = start.format();
    facet.maxvalAsText = end.format();
    facet.groupingTimeResolution = units;
    facet.groupingTimeFormat = fmt;
  } else if (facet.displayContinuous) {
    facet.minvalAsText = group.value().min.toString();
    facet.maxvalAsText = group.value().max.toString();
  }
}

/*
 * sampleDataset returns an array containing N random datums from the dataset
 * @memberof! Facet
 * @virtual
 * @function
 * @param {Dataset} dataset
 * @param {intger} N number of elements to pick
 * @returns {Object[]} data
 */
function sampleDataset (dataset, N) {
  var wantedElements = [];

  var i;
  for (i = 0; i < N; i++) {
    wantedElements[i] = Math.round(Math.random() * dataset.crossfilter.size());
  }

  var group = dataset.crossfilter.groupAll();
  group.reduce(
    function (p, d) { // add
      var i = wantedElements.indexOf(p.element);
      if (i > -1) {
        p.data[i] = d;
      }
      p.element++;
      return p;
    },
    function (p, v) { // subtract
      return p;
    },
    function () { // initialize
      return {
        element: [],
        data: []
      };
    }
  );
  return group.value().data;
}

/*
 * setCategories finds finds all values on an ordinal (categorial) axis
 * Updates the categorialTransform property of the facet
 *
 * @memberof Dataset
 * @param {Dataset} dataset
 * @param {Facet} facet
 */
function setCategories (dataset, facet, transformed) {
  var fn;
  if (transformed) {
    fn = utildx.valueFn(facet);
  } else {
    fn = utildx.baseValueFn(facet);
  }

  var group = dataset.crossfilter.groupAll();
  group.reduce(
    function (p, d) { // add
      var vs = fn(d);
      vs.forEach(function (v) {
        if (p.hasOwnProperty(v)) {
          p[v]++;
        } else {
          p[v] = 1;
        }
      });
      return p;
    },
    function (p, v) { // subtract
      return p;
    },
    function () { // initialize
      return {};
    }
  );
  if (transformed) {
    facet.groups.reset();
  } else {
    facet.categorialTransform.reset();
  }

  var data = group.value();
  Object.keys(data).forEach(function (k) {
    var keyAsString = k.toString();

    var groupAsString;
    if (keyAsString === misval) {
      groupAsString = facet.misval[0];
    } else {
      groupAsString = keyAsString;
    }
    if (transformed) {
      facet.groups.add({value: keyAsString, count: data[k], label: groupAsString});
    } else {
      facet.categorialTransform.add({expression: keyAsString, count: data[k], group: groupAsString});
    }
  });
}

/*
 * Calculate 100 percentiles (ie. 1,2,3,4 etc.)
 * Use the recommended method from [NIST](http://www.itl.nist.gov/div898/handbook/prc/section2/prc262.htm)
 * See also the discussion on [Wikipedia](https://en.wikipedia.org/wiki/Percentile)
 * @param {Dataset} dataset
 * @param {Facet} facet
 */
function setPercentiles (dataset, facet) {
  var basevalueFn = utildx.baseValueFn(facet);
  var dimension = dataset.crossfilter.dimension(basevalueFn);
  var data = dimension.bottom(Infinity);
  dimension.dispose();

  var x, i;

  // drop missing values, which should be sorted at the start of the array
  i = 0;
  while (basevalueFn(data[i]) === misval) i++;
  data.splice(0, i);

  // start clean
  facet.continuousTransform.reset();

  // add minimum value as p0
  facet.continuousTransform.add({x: basevalueFn(data[0]), fx: 0});

  var p, value;
  for (p = 1; p < 100; p++) {
    x = (p * 0.01) * (data.length + 1) - 1; // indexing starts at zero, not at one
    i = Math.trunc(x);
    value = (1 - x + i) * basevalueFn(data[i]) + (x - i) * basevalueFn(data[i + 1]);
    facet.continuousTransform.add({x: value, fx: p});
  }

  // add maximum value as p100
  facet.continuousTransform.add({x: basevalueFn(data[data.length - 1]), fx: 100});
}

/*
 * Calculate value where exceedance probability is one in 10,20,30,40,50,
 * and the same for -exceedance -50, -60, -70, -80, -90, -99, -99.9, -99.99, ... percent
 * Approximate from data: 1 in 10 is larger than value at index trunc(0.1 * len(data))
 * @param {Dataset} dataset
 * @param {Facet} facet
 */
function setExceedances (dataset, facet) {
  var basevalueFn = utildx.baseValueFn(facet);
  var dimension = dataset.crossfilter.dimension(basevalueFn);
  var data = dimension.bottom(Infinity);
  dimension.dispose();

  var exceedances = [];
  var i, oom, mult, n, value, valuep, valuem;

  // drop missing values, which should be sorted at the start of the array
  i = 0;
  while (basevalueFn(data[i]) === misval) i++;
  data.splice(0, i);

  // exceedance:
  // '1 in n' value, or what is the value x such that the probabiltiy drawing a value y with y > x is 1 / n

  if (data.length % 2 === 0) {
    valuem = basevalueFn(data[(data.length / 2) - 1]);
    valuep = basevalueFn(data[(data.length / 2)]);
    value = 0.5 * (valuem + valuep);
  } else {
    value = basevalueFn(data[(Math.trunc(data.length / 2))]);
  }
  exceedances = [{x: value, fx: 0}];

  // order of magnitude
  oom = 1;
  mult = 3;
  while (mult * oom < data.length) {
    n = oom * mult;

    // exceedance
    i = data.length - Math.trunc(data.length / n) - 1;
    value = basevalueFn(data[i]);

    exceedances.push({x: value, fx: n});

    // subceedance (?)
    i = data.length - i - 1;
    value = basevalueFn(data[i]);

    exceedances.unshift({x: value, fx: -n});

    mult++;
    if (mult === 10) {
      oom = oom * 10;
      mult = 1;
    }
  }

  // add minimum and maximum values
  exceedances.unshift({x: basevalueFn(data[0]), fx: -data.length});
  exceedances.push({x: basevalueFn(data[data.length - 1]), fx: data.length});

  // start clean
  facet.continuousTransform.reset();

  // generate rules
  exceedances.forEach(function (ex) {
    facet.continuousTransform.add(ex);
  });
}

/*
 * Autoconfigure a dataset:
 * 1. pick 10 random elements
 * 2. create facets for their properties
 * 3. add facets' values over the sample to the facet.description
 *
 * @memberof Dataset
 * @param {Dataset} dataset
 */
function scanData (dataset) {
  function facetExists (dataset, path) {
    var exists = false;
    dataset.facets.forEach(function (f) {
      if (f.accessor === path) {
        exists = true;
      }
    });
    return exists;
  }

  function addValue (values, v, missing) {
    if (v === misval) {
      v = missing;
    }
    if (values.indexOf(v) === -1) {
      values.push(v);
    }
  }

  function guessType (values) {
    var categorial = 0;
    var continuous = 0;
    values.forEach(function (value) {
      if (value === +value) {
        continuous++;
      } else {
        categorial++;
      }
    });
    if (categorial > continuous) {
      return 'categorial';
    } else {
      return 'continuous';
    }
  }

  function tryFacet (dataset, path, value) {
    // Check for existence
    if (facetExists(dataset, path)) {
      return;
    }

    // Create a new facet
    var facet = dataset.facets.add({
      name: path,
      accessor: path,
      type: 'categorial',
      misvalAsText: '"null"'
    });

    // Sample values
    var baseValueFn = utildx.baseValueFn(facet);
    var values = [];

    data.forEach(function (d) {
      var value = baseValueFn(d);
      if (value instanceof Array) {
        value.forEach(function (v) {
          addValue(values, v, facet.misval[0]);
        });
      } else {
        addValue(values, value, facet.misval[0]);
      }
    });

    // Reconfigure facet
    facet.type = guessType(values);
    facet.description = values.join(', ');
  }

  function recurse (dataset, path, tree) {
    var props = Object.getOwnPropertyNames(tree);

    props.forEach(function (name) {
      var subpath;
      if (path) subpath = path + '.' + name; else subpath = name;

      if (tree[name] instanceof Array) {
        // add an array as a categorial facet, ie. labelset, to prevent adding each element as separate facet
        // also add the array length as facet
        tryFacet(dataset, subpath, tree[name]);
        tryFacet(dataset, subpath + '.length', tree[name].length);
      } else if (tree[name] instanceof Object) {
        // recurse into objects
        recurse(dataset, subpath, tree[name]);
      } else {
        // add strings and numbers as facets
        tryFacet(dataset, subpath, tree[name]);
      }
    });
  }

  // Add facets
  var data = sampleDataset(dataset, 10);
  data.forEach(function (d) {
    recurse(dataset, '', d);
  });
}

/*
 * initDataFilter
 * Initialize the data filter, and construct the getData callback function on the filter.
 * @memberof Dataset
 * @param {Dataset} filter
 * @param {Filter} filter
 */
function initDataFilter (dataset, filter) {
  var facetA = filter.primary;
  var facetB = filter.secondary;
  var facetC = filter.tertiary;

  if (!facetA) facetA = new Facet({type: 'constant'});
  if (!facetC) facetC = facetB;
  if (!facetC) facetC = facetA;
  if (!facetB) facetB = new Facet({type: 'constant'});

  var valueA = utildx.valueFn(facetA);
  var valueB = utildx.valueFn(facetB);
  var valueC = utildx.valueFn(facetC);

  var groupA = utildx.groupFn(facetA);
  var groupB = utildx.groupFn(facetB);

  filter.dimension = dataset.crossfilter.dimension(function (d) {
    return valueA(d);
  });
  var group = filter.dimension.group(function (a) {
    return groupA(a);
  });

  group.reduce(
    function (p, v) { // add
      var bs = groupB(valueB(v));
      if (!(bs instanceof Array)) {
        bs = [bs];
      }

      var val = valueC(v);
      bs.forEach(function (b) {
        p[b] = p[b] || {count: 0, sum: 0};

        if (val !== misval) {
          p[b].count++;
          val = +val;
          if (val) {
            p[b].sum += val;
          }
        }
      });
      return p;
    },
    function (p, v) { // subtract
      var bs = groupB(valueB(v));
      if (!(bs instanceof Array)) {
        bs = [bs];
      }

      var val = valueC(v);
      bs.forEach(function (b) {
        if (val !== misval) {
          p[b].count--;
          val = +val;
          if (val) {
            p[b].sum -= val;
          }
        }
      });
      return p;
    },
    function () { // initialize
      return {};
    }
  );

  var reduce = utildx.reduceFn(facetC);

  filter.getData = function () {
    var result = [];

    // Get data from crossfilter
    var groups = group.all();

    // Unpack array dims
    groups = utildx.unpackArray(groups);

    // Post process

    // sum groups to calculate relative values
    var fullTotal = 0;
    var groupTotals = {};
    groups.forEach(function (group) {
      Object.keys(group.value).forEach(function (subgroup) {
        var value = reduce(group.value[subgroup]);
        groupTotals[group.key] = groupTotals[group.key] || 0;
        groupTotals[group.key] += value;
        fullTotal += value;
      });
    });

    // re-format the data
    groups.forEach(function (group) {
      Object.keys(group.value).forEach(function (subgroup) {
        // normalize
        var value = reduce(group.value[subgroup]);
        if (facetC.reducePercentage) {
          if (filter.secondary) {
            // we have subgroups, normalize wrt. the subgroup
            value = 100.0 * value / groupTotals[group.key];
          } else {
            // no subgroups, normalize wrt. the full total
            value = 100.0 * value / fullTotal;
          }
        }
        result.push({
          a: group.key,
          b: subgroup,
          c: value
        });
      });
    });
    filter.data = result;
    filter.trigger('newdata');
  };
}

/*
 * relaseDataFilter
 * The opposite or initDataFilter, it should remove the filter and deallocate other configuration
 * related to the filter.
 * @memberof Dataset
 * @param {Dataset} dataset
 * @param {Filter} filter
 */
function releaseDataFilter (dataset, filter) {
  if (filter.dimension) {
    filter.dimension.filterAll();
    filter.dimension.dispose();
    delete filter.dimension;
    delete filter.getData;
  }
}

/*
 * updateDataFilter
 * Change the filter parameters for an initialized filter
 * @memberof Dataset
 * @param {Dataset} dataset
 * @param {Filter} filter
 */
function updateDataFilter (dataset, filter) {
  if (filter.dimension) {
    filter.dimension.filterFunction(filter.filterFunction);
  } else {
    console.error('Cannot update data filter: no dimension set for filter');
  }
}

module.exports = Dataset.extend({
  props: {
    datasetType: {
      type: 'string',
      setOnce: true,
      default: 'crossfilter'
    }
  },
  initialize: function () {
    this.extendFacets(this, this.facets);
    this.extendFilters(this, this.filters);
  },

  /*
   * Implementation of virtual methods
   */
  scanData: function () {
    scanData(this);
  },
  setMinMax: setMinMax,
  setCategories: setCategories,
  setPercentiles: setPercentiles,
  setExceedances: setExceedances,

  initDataFilter: initDataFilter,
  releaseDataFilter: releaseDataFilter,
  updateDataFilter: updateDataFilter,

  /*
   * Crossfilter Object, for generating dimension
   */
  crossfilter: crossfilter
});
