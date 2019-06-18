var mainCnv, helpCnv, drawEnabled, cnvWrapper, msgBox, chartsCache = new Array(), infoBar, currentMarket, marketsSel, runTimer, priceAxisElements;
var drawing = {
    width   : null,
    height  : null,
    minX    : null,
    maxX    : null,
    minY    : null,
    maxY    : null
};
var historicalPrice = {
    lastPricePointTime  : null,
    lastPricePointValue : null,
    minValue            : null,
    maxValue            : null
};
var touchDevice = (function() {
    var el = document.createElement('div');
    el.setAttribute('ontouchstart', 'return;');
    if (typeof el.ontouchstart == 'function')
        return true;
    else
        return false;
})();

var stable = window.location.pathname.match(/Stable/) ? true : false;

document.addEventListener('DOMContentLoaded', function(){
    // UI elements shortcuts
    var workspace = document.getElementById("Workspace");
    mainCnv = document.getElementById("MainCnv");
    helpCnv = document.getElementById("HelpCnv");
    cnvWrapper = document.getElementById("CnvWrapper");
    infoBar = document.getElementById("Filler");
    var statusbar = document.getElementById("Statusbar");
    msgBox = document.getElementById("Statusbar");
    priceAxisElements = [];
    for (var i = 0; i < document.getElementById("PriceAxis").getElementsByTagName('div').length; ++i) {
        priceAxisElements.push(document.getElementById("Price"+i));
    }

    // set up workspace size and positions
    workspace.style.height = window.innerHeight - statusbar.offsetHeight + "px";
    mainCnv.width = cnvWrapper.offsetWidth * 2;
    mainCnv.height = cnvWrapper.offsetHeight/* + 4*/;
    helpCnv.width = cnvWrapper.offsetWidth;
    helpCnv.height = cnvWrapper.offsetHeight/* - 4*/;

    //
    // set up event listeners (UI behavior)
    //
    cnvWrapper.addEventListener('mousewheel', function(evt){
        this.scrollLeft -= evt.wheelDelta;
    }, false);

    drawEnabled = true;
    document.getElementById('DrawSwitch').addEventListener('click', function(){
        drawEnabled = this.checked;
    }, false);

    document.addEventListener('touchmove', function(evt){
        if (drawEnabled) {
            evt.preventDefault();
            return;
        }
        setTimeout(function(){cnvWrapper.scrollTop = 2;}, 1000); // avoid whole-app vertical scrolling by setting cnvWrapper scrollTop to the "middle" position
        //cnvWrapper.scrollTop = 2;
    }, false);

    setupTrendFollowingUI();
    
    var emaRng = document.getElementById("EMArng");

    document.getElementById("EMAMinus").addEventListener('click', function(){
        var emaRngVal = parseInt(emaRng.value, 10);
        if (emaRngVal > 0) emaRng.value = emaRngVal - 1;
    }, false);

    document.getElementById("EMAPlus").addEventListener('click', function(){
        emaRng.value = parseInt(emaRng.value, 10) + 1;
    }, false);
    
    document.getElementById('Run').addEventListener('click', runAnalysis, false);

    statusbar.innerHTML = "Load OK";
}, false);

function showMsg(msg) {msgBox.innerHTML = msg;}

function setupTrendFollowingUI() {
    // clear mainCnv, move it to the middle and draw a vertical line - "today" pointer
    clearCnv(mainCnv);
    clearCnv(helpCnv);
    helpCnv.style.zIndex = -5;
    infoBar.innerHTML = "";

    cnvWrapper.scrollLeft = mainCnv.width / 4;
    var context = mainCnv.getContext('2d');
    context.beginPath();
    context.strokeStyle = "gray";
    context.moveTo(mainCnv.width / 2, 20);
    context.lineTo(mainCnv.width / 2, mainCnv.height);
    context.stroke();
    context.textBaseline = "top";
    context.font = "20px sans-serif";
    context.fillStyle = "gray";
    context.fillText("<< past << today >> future >>", mainCnv.width / 2 - 130, 0);
    for (var i = 0; i < priceAxisElements.length; ++i) {
        priceAxisElements[i].innerHTML = "";
    }
}

function drawResults(res) {
    switch (res.name) {
        case "Progress":
            showMsg("Progress: "+ res.data);
            break;
        default:
            clearTimeout(runTimer);
            document.getElementById("Run").disabled = false;
            chartsCache = res;
            drawCharts();
            if (strategy.name == "RealSystem") drawDateAxis(mainCnv);
            showMsg("Results");
            break;
    }
}

function updatePriceAxis(min, max) {
    for (var i = 0; i < priceAxisElements.length; ++i) {
        priceAxisElements[i].innerHTML = (max - (max - min) / (priceAxisElements.length - 1) * i).toFixed(2);
        console.log("Update price axis: min " + min + " max " + max);
    }
}

function runAnalysis() {
    if (!priceChart) {
        showMsg("<b>Please draw a price chart first</b>");
        return;
    }
    if (touchDevice) {
        document.getElementById("DrawSwitch").checked = false;
        drawEnabled = false;
    }
    showMsg("Please wait");
    document.getElementById("Run").disabled = true;
    runTimer = setTimeout(function(){
        document.getElementById("Run").disabled = false;
    }, 15000);
    setGlobalConfig();
    clearCnv(helpCnv);
    process(priceChart, drawResults);
}

// set global strategy and drawing objects
function setGlobalConfig() {
    // drawing common
    drawing.height = helpCnv.height;

    // strategy and drawing specific
    strategy = {
        name    : "TrendFollowing",
        params  : [
                document.getElementById('EMA1').value,
                document.getElementById('EMA2').value,
                document.getElementById('EMArng').value,
                document.getElementById('Leverage').value
                ]
    };
    var now = new Date().getTime(); // ms
    var days2ms = 1000*60*60*24;
    var nowOffset = (cnvWrapper.offsetWidth - cnvWrapper.scrollLeft) / cnvWrapper.offsetWidth;
    drawing.width = helpCnv.width;
    drawing.minX = now - drawing.width * nowOffset * days2ms;
    drawing.maxX = now + drawing.width * (1 - nowOffset) * days2ms;
    if (priceChart) { // TODO
        var sc = parseInt(document.getElementById('PriceRange').value, 10);
        var priceOffset = (cnvWrapper.offsetHeight - priceChart.getY(0)) / cnvWrapper.offsetHeight;
        drawing.maxY = 100 + sc*(1 - priceOffset);
        drawing.minY = 100 - sc*priceOffset;
    } else {
        drawing.maxY = 100;
        drawing.minY = 100;
    }
}

// window.applicationCache.addEventListener('updateready', function() {
//     msgBox.innerHTML += " (update ready - <a href='javascript:location.reload()'>reload</a> to enable)";
// }, false);
// window.applicationCache.addEventListener('cached', function() {
//     msgBox.innerHTML += " (update ready - <a href='javascript:location.reload()'>reload</a> to enable)";
// }, false);
// window.applicationCache.addEventListener('noupdate', function() {
//     msgBox.innerHTML += " (no update)";
// }, false);
