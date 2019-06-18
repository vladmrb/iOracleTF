# iOracleTF

PoC project demontrating PPO https://www.investopedia.com/terms/p/ppo.asp technical analysis indicator. The project is targeting iPad 1 and is runnable from Safari browser or installable as a "web app". Should still work on Chrome-like browsers. The code is fully client side, so can be run from a local web server.

## Usage

The following parameters are adjustable:

  - "Price, %": price scale
  - "EMA 1,2": EMA parameters for PPO (see the link above)
  - "EMA +/-": EMA parameters range for optimizer ("0" disables optimizer)
  - "Leverage": leverage factor
  - "<<past<<today>>future>>" (slider adjustable by mouse wheel): set the "current date" for the optimizer
  - price chart to be drawn by mouse or finger, faster moves add more randomness
 
In the simplest case draw a desired price chart and click "Run". EMAs, signal, and theoretical perfo will be displayed. To try the optimizer set "EMA +/-" to a value higher than 0, set the desired "current date" and click "Run". The optimizer will try different EMA combinations to find the best perfo at the "current date". Increasing leverage may increase performance, but also increases risks: once you loose all the money you cannot recover.
