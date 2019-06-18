/* 
 * Server interaction interface
 */
var currentPriceCacheScript = null;
var useJSCache = true;

// uses marketsSel.value, days.value
function getCurrentPriceChart() {
    if (useJSCache) {
        var periods = [30,90,180,360,0];
        var daysReq = parseInt(days.value, 10);
        for (var daysP in periods) {
            if (daysReq <= periods[daysP]) break;
        }
        if (currentPriceCacheScript !== null) currentPriceCacheScript.parentNode.removeChild(currentPriceCacheScript);
        currentPriceCacheScript = null;
        currentPriceCacheScript = document.createElement("script");
        currentPriceCacheScript.src = "priceChartsJS/days"+periods[daysP]+"/"+marketsSel.value+".js";
        currentPriceCacheScript.id = "currentPriceJScache";
        currentPriceCacheScript.addEventListener('error', function(){
            showMsg("<b>Warning: couldn't load cached historical price chart.</b> Falling back...");
            chartsCache = [getXHRpriceChart()];
            setGlobalConfig();
            drawCharts();
            showMsg("Historical price loaded (fallback to server)");
        }, false);
        document.getElementsByTagName("head")[0].appendChild(currentPriceCacheScript);
        return null;
    } else {
        return getXHRpriceChart();
    }
    function getXHRpriceChart () {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "getCachedPrice.php?Market="+encodeURIComponent(marketsSel.value)+"&Days="+days.value, false);
        xhr.send();
        try {
            var chart = JSON.parse(xhr.responseText);
        } catch (e) {
            showMsg("Failed to fetch current price chart");
        }
        showMsg("Historical price loaded (server)");
        return chart;
    }
}

function iOracleSrv(vc, drawResultsCallback) {
    var xhr = new XMLHttpRequest();
    var vcStr = encodeURIComponent(JSON.stringify(vc));
    var response;
    xhr.onreadystatechange = function() {
        if (this.readyState >= 3 && this.status == 200) {
            response = this.responseText.split("\n");
            for (var v in response) {
                if (!response[v]) response.splice(v, 1);
            }
            try {
                var vr = JSON.parse(response[response.length - 1]);
            } catch (err) {
                console.log("JSON parser failed");
                return;
            }
            if (vr.name == "Padding") return;
            if (vr.name == "Progress") {drawResultsCallback(vr);return;}
            this.onreadystatechange = null;
            drawResultsCallback(vr);
        }
    }
    xhr.open('POST', "backend/proxyCLI.php", true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.send("VChart=" + vcStr);
}
