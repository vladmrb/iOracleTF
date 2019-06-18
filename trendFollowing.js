/*
 *  server side emulation
 *  get: VirtualChart(name: strategy, type: [parameters]); return: [VirtualChart(name: name, type: type)]
 */

// virtual chart: plot([time,value]) + name,type (JSON interchange format) / "Server side"
function VirtualChart(name, type) {
    this.name = name;
    this.type = type;
    this.data = new Array();
    function Point(time, value) {
        this.time = time;
        this.value = value;
    }
    this.addPoint = function (time, value) {
        this.data.push(new Point(time, value));
    }
}

function trendFollowing(priceChartIn, answerCallback) {
    function sma(smaWindow, priceChartOverride) {
        var priceChart = (priceChartOverride?priceChartOverride:priceChartIn);
        var smaChart = new VirtualChart("SMA"+smaWindow, "Overlay");
        var sma, i, j;
        for (i = smaWindow - 1; i < priceChart.data.length; i++) {
            sma = priceChart.data[i].value;
            for (j = 1; j < smaWindow; j++) sma += priceChart.data[i-j].value;
            sma = sma / smaWindow;
            smaChart.addPoint(priceChart.data[i].time, sma);
        }
        return smaChart;
    }

    function ema(emaWindow, priceChartOverride) {
        var priceChart = (priceChartOverride?priceChartOverride:priceChartIn);
        var mult = 2 / (emaWindow + 1);
        var emaChart = new VirtualChart("EMA"+emaWindow, "Overlay");
        var ema, pema=0, i;

        // SMA for the first pEMA
        for (i = 0; i < emaWindow; i++) {
            pema += priceChart.data[i].value;
        }
        pema = pema / emaWindow;
        emaChart.addPoint(priceChart.data[emaWindow - 1].time, pema);

        // EMA
        for (i = emaWindow; i < priceChart.data.length; i++) {
            ema = (priceChart.data[i].value - pema)*mult + pema;
            pema = ema;
            emaChart.addPoint(priceChart.data[i].time, ema);
        }
        return emaChart;
    }

    /*
     * signal: "signal"         - PPO signal        : [-1,0,1] based on 'PPO signal line'
     *         "signal line"    - PPO signal line   : 9 EMA of PPO
     *         undefined        - PPO               : raw PPO
     */
    function ppo(ema1, ema2, signal) {
        var ppoChart = new VirtualChart("PPO", "Oscillator");
        var ppo, i;
        var lenDiff = ema1.data.length - ema2.data.length;
        for (i = 0 - Math.min(0, lenDiff); i < ema2.data.length; i++) {
            ppo = (ema1.data[i + lenDiff].value - ema2.data[i].value) / ema2.data[i].value;
            //ppoChart.addPoint(ema2.data[i].time, ppo);
            ppoChart.addPoint(ema1.data[i + lenDiff].time, ppo);
        }
        if (signal && signal.match(/signal/)) { // Signal or signal line
            var ppoChartEMA = ema(9, ppoChart);
            ppoChartEMA.name = "PPO signal line (9 EMA)";
            ppoChartEMA.type = "Oscillator";
            ppoChart = ppoChartEMA;
        }
        if (signal == "signal") {
            for (i in ppoChart.data)
                ppoChart.data[i].value = ppoChart.data[i].value > 0 ? 1 : (ppoChart.data[i].value < 0 ? -1 : 0);
            ppoChart.name = "Signal (PPO)";
            ppoChart.type = "Signal";
        }
        return ppoChart;
    }

    function perfo(signal, leverage, priceChartOverride) {
        var priceChart = (priceChartOverride?priceChartOverride:priceChartIn);
        var i, cSignal,                 // current signal
            cPrice,                     // current price
            cProfit,                    // current profit
            lenDiff = priceChart.data.length - signal.data.length,
            pPrice = priceChart.data[lenDiff].value, // previous price
            cMoney = pPrice*10,
            moneyChart = new VirtualChart("Perfo", "Money");

        moneyChart.addPoint(signal.data[0].time, cMoney);
        for (i = 1; i < signal.data.length; i++) {
            if (cMoney*leverage < pPrice) continue; // we cannot trade
            cPrice = priceChart.data[i+lenDiff].value;
            cSignal = signal.data[i-1].value;
            cProfit = (cPrice - pPrice)*cSignal*cMoney*leverage/pPrice;
            pPrice = cPrice;
            cMoney += cProfit;
            moneyChart.addPoint(signal.data[i].time, cMoney);
        }
        moneyChart.name += " " + Math.round((moneyChart.data[moneyChart.data.length - 1].value - moneyChart.data[0].value) /
                                            (/*priceChart.data[moneyChart.data.length - 1].value - */moneyChart.data[0].value) * 100) + "%";
        if (leverage > 1) moneyChart.name += " (lev "+leverage+")";
        return moneyChart;
    }

    // Non-blocking perfo optimizer:
    // make an iteration of perfo calculation for a pait of EMA1 and EMA2 windows, renew the pair and schedule next iteration,
    // last iteration sends the perfo back, others send back the progress packets
    function optimizePerfo(emaWindow1, emaWindow2, emaMinWindow1, emaMinWindow2, emaMaxWindow1, emaMaxWindow2, leverage, bestProfit, bestAnswer) {
        if (emaWindow1 != emaWindow2) {
            var curProfit, today = new Date().getTime(), i;
            var curEma1 = ema(emaWindow1),
                curEma2 = ema(emaWindow2),
                curPPO2 = ppo(curEma1, curEma2, "signal"),
                curPerfo1 = perfo(curPPO2, leverage);
            // for "partial date" strategy we take the most recent date perfo as "current", otherwise - the last perfo
            if (curPerfo1.data[curPerfo1.data.length - 1].time > today) {
                for (i = 1; i < curPerfo1.data.length; i++) {
                    if (curPerfo1.data[i].time > today) break;
                }
                curProfit = curPerfo1.data[i-1].value;
            } else {
                curProfit = curPerfo1.data[curPerfo1.data.length - 1].value;
            }
            if (curProfit > bestProfit || bestProfit === null || typeof bestProfit === 'undefined') {
                bestProfit = curProfit;
                bestAnswer = [priceChartIn, curEma1, curEma2, curPPO2, curPerfo1];
            }
        }
        if (emaWindow2 < emaMaxWindow2) {
            emaWindow2++;
            setTimeout(optimizePerfo, 0, emaWindow1, emaWindow2, emaMinWindow1, emaMinWindow2, emaMaxWindow1, emaMaxWindow2, leverage, bestProfit, bestAnswer);
        } else if (emaWindow1 < emaMaxWindow1) {
            emaWindow2 = emaMinWindow2;
            emaWindow1++;
            answerCallback({"name":"Progress", "data":Math.round((emaWindow1 - emaMinWindow1)/(emaMaxWindow1 - emaMinWindow1)*100)});
            setTimeout(optimizePerfo, 0, emaWindow1, emaWindow2, emaMinWindow1, emaMinWindow2, emaMaxWindow1, emaMaxWindow2, leverage, bestProfit, bestAnswer);
        } else {
            answerCallback(bestAnswer ? (function() {bestAnswer.push(price0); return bestAnswer;})() : {name:"Progress", data:"No best perfo"});
        }
    }

    var price0 = {name:"Price0", type:"Price0", data:[{time:0,value:100}]};
    switch (priceChartIn.name) {
        case "SMA":             // "SMA" strategy - just SMA calculation
            answerCallback([sma(parseInt(priceChartIn.type[0])), price0]);
            break;
        case "TrendFollowing":
            // get strategy parameters
            var emaWindow1 = parseInt(priceChartIn.type[0], 10),
                emaWindow2 = parseInt(priceChartIn.type[1], 10),
                emaRange = parseInt(priceChartIn.type[2], 10),
                leverage = parseInt(priceChartIn.type[3], 10);
            if (leverage < 1) leverage = 1;
            if (emaRange < 0) emaRange = 0;
            if (emaWindow1 < 1) emaWindow1 = 1;
            if (emaWindow2 < 1) emaWindow2 = 1;
            priceChartIn.name = "Price";
            priceChartIn.type = "Price";
            // if EMA+/- is zero - do not iterate over different EMA windows and simply calculate the given variant
            if (emaRange == 0) {
                var ema1 = ema(emaWindow1),
                    ema2 = ema(emaWindow2),
                    ppo1 = ppo(ema1, ema2, "signal"),
                    perfo1 = perfo(ppo1, leverage);
                answerCallback([priceChartIn, ema1, ema2, ppo1, perfo1, price0]);
            } else {
                // iterate over ema parameters within range to find the best perfo
                var emaMinWindow1 = emaWindow1 - emaRange > 0 ? emaWindow1 - emaRange : 1,
                    emaMinWindow2 = emaWindow2 - emaRange > 0 ? emaWindow2 - emaRange : 1,
                    emaMaxWindow1 = emaWindow1 + emaRange < priceChartIn.data.length ? emaWindow1 + emaRange : priceChartIn.data.length,
                    emaMaxWindow2 = emaWindow2 + emaRange < priceChartIn.data.length ? emaWindow2 + emaRange : priceChartIn.data.length;
                setTimeout(optimizePerfo, 0, emaMinWindow1, emaMinWindow2, emaMinWindow1, emaMinWindow2, emaMaxWindow1, emaMaxWindow2, leverage, null, null);
            }
            break;
        default:
            answerCallback([]);
            break;
    }

    return;
}

if (typeof exports != 'undefined') exports.run = trendFollowing;
//self.addEventListener("message", function(e) {
//    self.postMessage(iOracle(e.data));
//}, false);
