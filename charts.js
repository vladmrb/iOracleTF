var chartScale = 0.8;

/*
 *
 */
function drawCharts() {
    var charts = chartsCache;
    var cnv = strategy.name == 'TrendFollowing' ? helpCnv : mainCnv;
    var colors = {"Price"           : "DarkRed",
                  "CurrentPrice"    : "DarkRed",
                  "HistoricalPrice" : "DarkRed",
                  "Money"           : "Green",
                  "Signal"          : "CornflowerBlue",
                  "Volume"          : "LightGray"};
    var colorsAlt = ["DodgerBlue", "orange", "darkmagenta", "pink", "yellow", "black"]; // overlays

    var color, colorsIdx = 0;
    var i;
    clearCnv(cnv);
    infoBar.innerHTML = "";
    function dashedLine(sx, sy, tx, ty) {
        var cx = sx;
        var cy = sy;
        var c = cnv.width/4;
        var dx = (tx - sx) / c;
        var dy = (ty - sy) / c;
        context.moveTo(cx, cy);
        cx += dx;
        cy += dy;
        context.lineTo(cx, cy);
        while(cx <= tx && cy <= ty) {
            cx += dx;
            cy += dy;
            context.moveTo(cx > tx ? tx : cx, cy > ty ? ty : cy);
            cx += dx;
            cy += dy;
            context.lineTo(cx > tx ? tx : cx, cy > ty ? ty : cy);
        }
    }

    var context = cnv.getContext("2d");
    for (var c in charts) {
        var cChart = /*charts[c].name == "Price"? charts[c] : */unpack(charts[c]);
        if (cChart.type == "Price0") continue;
        if (cChart.plot.length == 0) continue;

        // set up parameters: color, linewidth
        if (colors[cChart.type])
            color = colors[cChart.type];
        else
            color = colorsAlt[colorsIdx++ % colorsAlt.length];
        context.strokeStyle = color;
        context.lineWidth = 2;

        if (cChart.type == "Signal") {
            context.lineWidth = 1;
            context.beginPath();
            dashedLine(0, Math.floor(cnv.height*(1 - chartScale) / 2) +1.5, cnv.width, Math.floor(cnv.height*(1 - chartScale) / 2) +1.5)
            dashedLine(0, Math.floor(cnv.height / 2)+0.5, cnv.width, Math.floor(cnv.height / 2)+0.5);
            dashedLine(0, Math.floor(cnv.height*(1 - chartScale) / 2 + cnv.height*chartScale)+0.5, cnv.width, Math.floor(cnv.height*(1 - chartScale) / 2 + cnv.height*chartScale)+0.5);
            context.stroke();
        }

        context.beginPath();
        context.moveTo(cChart.getX(0), cChart.getY(0));
        if (cChart.type == "Volume") {
            for (i = 1; i < cChart.plot.length; i++) {
                context.moveTo(cChart.getX(i), cnv.height);
                context.lineTo(cChart.getX(i), cChart.getY(i));
            }
        } else {
            for (i = 1; i < cChart.plot.length; i++) {
                context.lineTo(cChart.getX(i), cChart.getY(i));
            }
        }
        if (charts[c].type.match(/Price/)) {
            context.lineTo(cnv.width, cChart.getY(i-1));
            context.lineTo(cnv.width, cnv.height+1);
            context.lineTo(0, cnv.height+1);
            context.lineTo(0, cChart.getY(0));
            context.closePath();
            var gradient = context.createLinearGradient(0, 0, 0, cnv.height);
            gradient.addColorStop(0, "pink");
            gradient.addColorStop(1, "white");
            context.fillStyle = gradient;
            context.fill();
        }
        context.stroke();
        //if (charts[c].type.match(/Price/)) drawDateAxis(cnv);
        
        // middle separator
        if (cChart.type == "Volume") {
            context.strokeStyle = "lightgray";
            context.lineWidth = 2;
            context.beginPath();
            dashedLine(cnv.width /2, 0, cnv.width/2, cnv.height);
            context.stroke();
        }

        // put info on plot or in msgBox (do not add info if the chart is redrawn in DynamicPrice mode)
        infoBar.innerHTML += '<br><span style="color:'+color+';">&nbsp;' + charts[c].name + '</span>';
    }
}

// uses marketsSel.value to draw a historical price chart
function refreshCharts() {
    var currentPriceChart = getCurrentPriceChart(marketsSel.value);

    currentMarket = marketsSel.value;
    if (currentPriceChart) { // sync with makeJSCache
        chartsCache = [currentPriceChart];
        setGlobalConfig();
        drawCharts();
    }
}

function drawDateAxis(cnv) {
    var context = cnv.getContext("2d");

    function smartDate() {
        function pad(i) {
            if (i < 10) return "0" + i; else return "" + i;
        }
        if (dateDiff > 150*day)    // 150 days: return month and year
            return pad(cDate.getMonth() + 1) + "." + (cDate.getYear() + 1900);
        //if (dateDiff > 30*day)     // 30 - 150 days: return day, month and year
        return pad(cDate.getDate()) + "." + pad(cDate.getMonth() + 1) + "." + pad(cDate.getYear() + 1900);
        //return pad(cDate.getDate()) + "." + pad(cDate.getMonth() + 1) + "." + pad(cDate.getYear() + 1900) + " " + pad(cDate.getHours()) + "h";
    }

    var cDate = new Date();
    var dtDistance = /*strategy.name == "RealSystem"
        ? new Date((drawing.maxX - drawing.minX) / 20)
        : */new Date((drawing.maxX - drawing.minX) / 10);
    dtDistance.setHours(0, 0, 0, 0);
    var day = 24*60*60*1000;                            // ms in day
    var dateDiff = drawing.maxX - drawing.minX;
    cDate.setTime(drawing.minX);
    context.font = 12 + "px sans-serif";
    context.textBaseline = "bottom";
    context.fillStyle = "black";
    context.strokeStyle = "gray";

    // round dtDistance to day or month
    if (dtDistance.getTime() < day) dtDistance.setTime(day);
    cDate.setDate(cDate.getDate() + 1);
    if (dateDiff > 150*day && dtDistance.getTime() < 32*day) dtDistance.setTime(32*day);
    if (dateDiff > 150*day) cDate.setMonth(cDate.getMonth() + 1);

    context.lineWidth = 1;
    context.beginPath();
    while (cDate.getTime() < drawing.maxX) {
        cDate.setHours(0, 0, 0, 0);
        if (dateDiff > 150*day) cDate.setDate(1);
        var cDateStr = smartDate();
        var pos = (cDate.getTime() - drawing.minX) / dateDiff * cnv.width;
        context.moveTo(pos, cnv.height);
        context.lineTo(pos, cnv.height - 10);
        context.strokeText(cDateStr, pos+3, cnv.height);
        context.fillText(cDateStr, pos+3, cnv.height);
        cDate.setTime(cDate.getTime() + dtDistance.getTime()+10000);
    }
    context.strokeStyle = "black";
    context.stroke();
}
