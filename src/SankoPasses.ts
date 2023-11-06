import { Trade as TradeEvent } from "../generated/SankoPasses/SankoPasses";
import { Trade, ProtocolDaily, Protocol } from "../generated/schema";
import { PROTOCOL, BIGINT_ONE, BIGINT_ZERO } from "./constants";
import { GetOrCreateAccount, GetOrCreateAccountDaily, GetOrCreateHolding, GetOrCreateProtocol, getPrice } from "./helpers";
import { BigInt, ethereum } from "@graphprotocol/graph-ts";

export function handleTrade(event: TradeEvent): void {
  let trader = GetOrCreateAccount(event.params.trader);
  let subject = GetOrCreateAccount(event.params.streamer);
  let holding = GetOrCreateHolding(trader, subject);
  let protocol = GetOrCreateProtocol();

  // Bring store to local variable
  let holdingKeysOwned = holding.keysOwned;
  let subjectKeyupply = subject.keySupply;
  let subjectHoldersCount = subject.holdersCount;

  // Increment Counters on purchase
  if (event.params.isBuy) {
    // Update the holders Count if the new holder had 0 shares previously
    if (holdingKeysOwned == BIGINT_ZERO && event.params.passAmount.gt(BIGINT_ZERO)) {
      subject.holdersCount = subjectHoldersCount.plus(BIGINT_ONE);
    }

    holding.keysOwned = holdingKeysOwned.plus(event.params.passAmount);
    subject.keySupply = subjectKeyupply.plus(event.params.passAmount);
  }
  // Decrement Counters on sale
  else {
    // If this is the last share the person owns, decrement the holders count for the subject
    if (holdingKeysOwned.minus(event.params.passAmount) == BIGINT_ZERO) {
      subject.holdersCount = subjectHoldersCount.minus(BIGINT_ONE);
    }

    holding.keysOwned = holdingKeysOwned.minus(event.params.passAmount);
    subject.keySupply = subjectKeyupply.minus(event.params.passAmount);
  }

  // Update the revenue metric for the subject and protocol
  subject.accountRevenue = subject.accountRevenue.plus(event.params.streamerEthAmount);
  protocol.protocolRevenue = protocol.protocolRevenue.plus(event.params.protocolEthAmount);
  protocol.accountRevenue = protocol.accountRevenue.plus(event.params.streamerEthAmount);
  protocol.tradeVolume = protocol.tradeVolume
    .plus(event.params.ethAmount)
    .plus(event.params.protocolEthAmount)
    .plus(event.params.streamerEthAmount);
  protocol.totalTrades = protocol.totalTrades.plus(BIGINT_ONE);

  // update timestamp
  protocol.timestamp = event.block.timestamp;
  holding.timestamp = event.block.timestamp;
  subject.timestamp = event.block.timestamp;

  protocol.save();
  holding.save();
  subject.save();

  // Event details
  let trade = new Trade(event.transaction.hash.concatI32(event.logIndex.toI32()));
  trade.trader = trader.id;
  trade.subject = subject.id;
  trade.referrer = event.params.referrer
  trade.referralEthAmount = event.params.referralEthAmount
  trade.isBuy = event.params.isBuy;
  trade.passAmount = event.params.passAmount;
  trade.ethAmount = event.params.ethAmount;
  trade.protocolEthAmount = event.params.protocolEthAmount;
  trade.subjectEthAmount = event.params.streamerEthAmount;
  trade.supply = event.params.supply;

  trade.blockNumber = event.block.number;
  trade.blockTimestamp = event.block.timestamp;
  trade.transactionHash = event.transaction.hash;

  // increment traders trade counter
  trader.tradesCount = trader.tradesCount.plus(BIGINT_ONE);

  // update timestamps
  trader.timestamp = event.block.timestamp;

  trade.save();
  trader.save();

  // TIMESERIES UPDATES
  const day = event.block.timestamp.div(BigInt.fromI32(86400));
  let accountDaily = GetOrCreateAccountDaily(subject, day);

  // Collection Address - Day
  let protocolDailyId = PROTOCOL.toHexString() + "-" + day.toString();

  let dailyEntity = ProtocolDaily.load(protocolDailyId);

  if (!dailyEntity) {
    dailyEntity = new ProtocolDaily(protocolDailyId);
    dailyEntity.protocol = PROTOCOL;
    dailyEntity.day = day;
    dailyEntity.dayProtocolRevenue = BIGINT_ZERO;
    dailyEntity.dayTrades = BIGINT_ZERO;
    dailyEntity.dayBuyVolume = BIGINT_ZERO;
    dailyEntity.daySellVolume = BIGINT_ZERO;
    dailyEntity.totalTradeVolume = BIGINT_ZERO;
    dailyEntity.dayTradeVolume = BIGINT_ZERO;
    dailyEntity.totalAccountRevenue = BIGINT_ZERO;
    dailyEntity.dayAccountRevenue = BIGINT_ZERO;
  }

  accountDaily.timestamp = event.block.timestamp;
  if (trade.isBuy) {
    accountDaily.dayBuyVolume = accountDaily.dayBuyVolume.plus(trade.ethAmount)
    accountDaily.dayPriceChange = getPrice(subject.keySupply.plus(trade.passAmount), BIGINT_ONE).minus(getPrice(subject.keySupply, BIGINT_ONE))
  } else {
    accountDaily.daySellVolume = accountDaily.daySellVolume.plus(trade.ethAmount)
    accountDaily.dayPriceChange = getPrice(subject.keySupply, BIGINT_ONE).minus(getPrice(subject.keySupply.minus(trade.passAmount), BIGINT_ONE))
  }
  //Add incrementors
  dailyEntity.timestamp = event.block.timestamp;
  dailyEntity.userCount = protocol.userCount;
  dailyEntity.totalProtocolRevenue = protocol.protocolRevenue;
  dailyEntity.totalAccountRevenue = protocol.accountRevenue;
  dailyEntity.totalTradeVolume = protocol.tradeVolume;
  dailyEntity.totalTrades = protocol.totalTrades;

  dailyEntity.dayProtocolRevenue = dailyEntity.dayProtocolRevenue.plus(trade.protocolEthAmount);
  dailyEntity.dayAccountRevenue = dailyEntity.dayAccountRevenue.plus(trade.subjectEthAmount);
  dailyEntity.dayTradeVolume = dailyEntity.dayTradeVolume
    .plus(trade.ethAmount)
    .plus(trade.protocolEthAmount)
    .plus(trade.subjectEthAmount);
  dailyEntity.dayTrades = dailyEntity.dayTrades.plus(BIGINT_ONE);
  if (trade.isBuy) {
    dailyEntity.dayBuyVolume = dailyEntity.dayBuyVolume.plus(trade.ethAmount);
  } else {
    dailyEntity.daySellVolume = dailyEntity.daySellVolume.plus(trade.ethAmount);
  }

  dailyEntity.save();
  accountDaily.save();
}
