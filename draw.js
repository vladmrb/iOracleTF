/* 
 * Draw and Charts module
 */

var isDrawing, posX, posY, priceChart, minY, maxY, cnvX, cnvY, userPriceHeight;

/*
 *  real chart: plot([x,y]) + parameters(type, name)
 *  purpose: draw on canvas
 */
function RealChart(name, type) {
    this.name = name;
    this.type = type;
    this.plot = new Array();
    function Point(x,y) {
        this.x = x;
        this.y = y;
    }
    this.addPoint = function (x,y) {
        this.plot.push(new Point(x,y));
    }
    this.getX = function (i) {
        return this.plot[i].x;
    }
    this.getY = function (i) {
        return this.plot[i].y;
    }
}

function clearCnv(cnv) {cnv.getContext("2d").clearRect(0, 0, cnv.width, cnv.height);}

document.addEventListener('DOMContentLoaded', function(){
    mainCnv.addEventListener('touchstart', startDraw, false);
    mainCnv.addEventListener('touchmove', draw, false);
    mainCnv.addEventListener('touchend', stopDraw, false);
    mainCnv.addEventListener('mousedown', startDraw, false);
    mainCnv.addEventListener('mousemove', draw, false);
    mainCnv.addEventListener('mouseup', stopDraw, false);
    mainCnv.addEventListener('mouseout', stopDraw, false);

    cnvX = helpCnv.offsetLeft;
    cnvY = helpCnv.offsetTop;
    var el = helpCnv;
    while ((el = el.offsetParent)) {
        cnvX += el.offsetLeft;
        cnvY += el.offsetTop;
    }

}, false);

function startDraw(evt) {
    if (!drawEnabled) return;
    if (!evt) evt = window.event;
    evt.preventDefault();
    if (navigator.platform == "iPad") {
        if (evt.targetTouches.length > 1) { // more than one finger touch => go to panning mode
            isDrawing = false;
            drawEnabled = false;
            document.getElementById("DrawSwitch").checked = false;
            return;
        }
        if (evt.type == "touchstart") evt = evt.targetTouches[0];
    }

    isDrawing = true;
    showMsg("Drawing");

    posX = (evt.pageX - cnvX);
    posY = (evt.pageY - cnvY);
    clearCnv(helpCnv);

    priceChart = new RealChart("Price", "HistoricalPrice");
    priceChart.addPoint(posX, posY);
    minY = posY;
    maxY = posY;
}

function stopDraw() {
    if (isDrawing) {
        showMsg("Drawing finished");
        isDrawing = false;
        userPriceHeight = maxY - minY;
    }
}

function draw(evt) {
    if (!evt) evt = window.event;
    // Check the element is in the DOM and the browser supports canvas
    if(helpCnv.getContext) {
        if (!isDrawing) return;
        if (navigator.platform == 'iPad')
            evt = evt.targetTouches[0];
        var dX = (evt.pageX - cnvX) - posX;
        var dY = (evt.pageY - cnvY) - posY;
        if (dX < 1 || posX + dX > helpCnv.width) return;

        // move to tha previous point
        var context = helpCnv.getContext('2d');
        context.strokeStyle = "black";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(posX,posY);

        // draw interpolated line from the last point to the current
        var vola;
        for (var i = 1; i < dX; i++) {
            vola = (Math.random() * 2 - 1) * 0.01 * helpCnv.offsetHeight; // K = ([0,1]*2 - 1) * 0.01 * height = [-0.01;0.01]*height
            posX += 1;
            posY += dY/dX + vola; // note: this may produce cumulative effects of vola, if interpolation period is large (user draws fast)
            context.lineTo(posX, posY);
            priceChart.addPoint(posX, posY);
            if (posY > maxY) maxY = posY;
            if (posY < minY) minY = posY;
        }
        context.stroke();
    }
}
