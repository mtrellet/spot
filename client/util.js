
var id_counter = 0;

var newId = function () {
    var id = id_counter++;

    return id;
};


// A dummy facet to simplify implementation
// behaves like a categorial facet
var unitFacet = {
    name: 'unity',
    isContinuous: false,
    isCategorial: true,

    displayContinuous: false,
    displayCategorial: true,
    displayTime: false,

    reduction: 'count',
    reduceSum: false,
    reduceCount: true,
    reduceAverage: false,

    reduction_type: 'absolute',
    reduceAbsolute: true,
    reducePercentage: false,

    // crossfilter stubs
    value: function () {return ["1"];},
    group: function (d) {return d;},

    // sql stubs
    field: "1",
    accessor: "1",
};




module.exports = {
    unitFacet:  unitFacet,
    newId: newId,
};
