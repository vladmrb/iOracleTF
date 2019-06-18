/*
 *  gets: chart : VirtualChart; drawing, chartScale, days, returns: chart : RealChart
 *  imports: drawing.{width, height, maxX, minX, maxY, minY}, strategy.{name, params}, VirtualChart()
 */
function unpack(vchart) {
    var min, max;
    function value2pos(value) {
        switch (vchart.type) {
            // rescale: drawing.height - (value - min) / (max - min) * drawing.height * scale - drawing.height * (1 - scale) / 2, scale = (0;1]
            case "Oscillator":  // [-1;1]
                return Math.round(drawing.height - (value + 1) / 2 * drawing.height);
            case "Signal":      // [-1,0,1]
                return Math.round(drawing.height - (value + 1) / 2 * drawing.height * chartScale - drawing.height * (1 - chartScale)/2)+0.5;
            case "Money":       // [minMoney;maxMoney]
                return Math.round(drawing.height - (value - min) / (max - min) * drawing.height * chartScale - drawing.height * (1 - chartScale)/2);
            case "HistoricalPrice":
            case "CurrentPrice":
                return Math.round(drawing.height - (value - min) / (max - min) * drawing.height);
            case "Volume":
                return Math.round(drawing.height - (value / max) * drawing.height * (1 - chartScale)/4);
            default:            // Overlay, etc
                return Math.round(drawing.height - (value - drawing.minY) / (drawing.maxY - drawing.minY) * drawing.height);
        }
    }
    function time2pos(time) {
        return Math.round((time - drawing.minX) / (drawing.maxX - drawing.minX) * drawing.width);
    }

    var days2ms = 1000*60*60*24;
    if (vchart.type == "CurrentPrice") {
        historicalPrice.lastPricePointTime = vchart.data[vchart.data.length - 1].time;
        drawing.minX = historicalPrice.lastPricePointTime - parseInt(days.value, 10) * days2ms;
        drawing.maxX = historicalPrice.lastPricePointTime + parseInt(days.value, 10) * days2ms;
        console.log("CurrentPrice minX: " + new Date(drawing.minX) + " maxX: " + new Date(drawing.maxX));
    }

    // calculate min and max of VirtualChart for scaling
    if (vchart.type == "Money" || vchart.type == "HistoricalPrice" || vchart.type == "CurrentPrice" || vchart.type == "Volume") {
        for (i = 0; i < vchart.data.length; ++i) {
            if (vchart.data[i].time < drawing.minX) continue;
            if (typeof min == 'undefined' || vchart.data[i].value < min) min = vchart.data[i].value;
            if (typeof max == 'undefined' || vchart.data[i].value > max) max = vchart.data[i].value;
        }
    }
    // calculate perfo
    var now = new Date().getTime();
//
//    if (vchart.type == "Money") {
//        for (i = 0; i < vchart.data.length; ++i) {
//            if (vchart.data[i].time < now) continue;
//            var perfo = (vchart.data[vchart.data.length - 1].value - vchart.data[i].value) / vchart.data[i].value * 100;
//            break;
//        }
//    }

    // make RealChart
    var rc = new RealChart(vchart.name, vchart.type);
    var dt = new Date(), dt1 = new Date();
    var x, y, lastX = -1;
    for (var i = 0; i < vchart.data.length; ++i) {
        if (vchart.data[i].time < drawing.minX) {continue;}
        dt.setTime(vchart.data[i>0?i-1:0].time);
        dt1.setTime(vchart.data[i].time);
        if (!stable && dt1.getTime() - dt.getTime() > 30*days2ms) alert("Oops, more than 30 days between two points @" + vchart.name +":\n"+dt.toString()+"\n"+dt1.toString());
        x = time2pos(vchart.data[i].time);
        //if (x == lastX) continue;
        //lastX = x;
        y = value2pos(vchart.data[i].value);
        rc.addPoint(x, y);
        if (!stable && vchart.type == "Volume" && vchart.data[i].time > now && vchart.data[i].value > 0) alert("Volume "+vchart.data[i].value+"@"+dt1.toString());
    }
    if (vchart.type == "CurrentPrice") {
        historicalPrice.lastPricePointValue = vchart.data[vchart.data.length - 1].value;
        historicalPrice.minValue = min;
        historicalPrice.maxValue = max;
    }
    if (vchart.type == "CurrentPrice" || vchart.type == "HistoricalPrice") {
        updatePriceAxis(min, max);
    }
    if (vchart.type == "Price") {// user price from TrendFollowing
        updatePriceAxis(drawing.minY, drawing.maxY);
    }
    //if (vchart.type == "Money") rc.name = "Perfo ("+perfo.toPrecision(5)+"%)";

    return rc;
}

// pack drawing for sending to the server process
function pack(rchart) {
    function pos2time(posX) {
        var offsetTime = new Date((posX - firstX)/drawing.width * (drawing.maxX - drawing.minX) + 
                                  (strategy.name == "RealSystem" ? historicalPrice.lastPricePointTime : drawing.minX));
        return offsetTime.getTime();
    }
    function pos2value(posY) {
        var price = ((drawing.height - posY) / drawing.height) * (drawing.maxY - drawing.minY) + drawing.minY;
        return (price > drawing.minY ? price : drawing.minY);
    }
    var vc = new VirtualChart(strategy.name, strategy.params);
    if (strategy.name == "RealSystem") vc.name = "Test";
    var time, value;
    var firstX = rchart.getX(0);
    for (var i = 0; i < rchart.plot.length; i++) {
        time = pos2time(rchart.getX(i));
        value = pos2value(rchart.getY(i));
        vc.addPoint(time, value);
    }
    //var vcStr = encodeURIComponent(JSON.stringify(vc));
    return vc/*Str*/;
}

function process(chart, drawResultsCallback) {
    /*
     *  virtual chart: plot([time,value]) + name,type (JSON interchange format)
     *  purpose: data exchange client <-> server
     *  Client -> Server : name - strategy name, type - strategy parameters, data - price graph UnixTime->Price
     *  Server -> Client : name - name to display, type - scaling type, data - plot to draw UnixTime->Value(type)
     */

    // process procedure
    var vc = pack(chart);
    console.log("Sent user price from " + new Date(vc.data[0].time) + " to " + new Date(vc.data[vc.data.length - 1].time));
    switch (strategy.name) {
        case "TrendFollowing":
            trendFollowing(vc, drawResultsCallback);
            break;
        case "RealSystem":
            iOracleSrv(vc, drawResultsCallback);
            break;
    }
    return;
}
