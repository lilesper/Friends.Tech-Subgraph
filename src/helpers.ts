import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Account, AccountDaily, Holding, Protocol } from "../generated/schema";
import { BIGINT_ONE, BIGINT_ZERO, PROTOCOL } from "./constants";

let BIGINT_SIX = BigInt.fromU32(6);
let BIGINT_TWO = BigInt.fromU32(2);
let BIGINT_ETHER = BigInt.fromU32(10).pow(18);

export function getPrice(supply: BigInt, amount: BigInt): BigInt {
  let sum1: BigInt;
  let sum2: BigInt;
  if (supply == BIGINT_ZERO) {
    sum1 = BIGINT_ZERO;
  } else {
    sum1 = ((supply.minus(BIGINT_ONE)).times(supply).times(BIGINT_TWO.times(supply.minus(BIGINT_ONE)).plus(BIGINT_ONE))).div(BIGINT_SIX);
  }

  if (supply == BIGINT_ZERO && amount == BIGINT_ONE) {
    sum2 = BIGINT_ZERO;
  } else {
    sum2 = (supply.minus(BIGINT_ONE).plus(amount)).times(supply.plus(amount)).times(BIGINT_ONE.plus(BIGINT_ONE).times(supply.minus(BIGINT_ONE).plus(amount)).plus(BIGINT_ONE)).div(BIGINT_SIX);
  }

  let summation: BigInt = sum2.minus(sum1);

  return summation.times(BIGINT_ETHER).div(BigInt.fromU32(16000));  // Assuming equivalent of `1 ether` is `1` in this context
}

// Pseudo-function to load or create AccountDaily for an account for a specific day
export function GetOrCreateAccountDaily(account: Account, day: BigInt): AccountDaily {
  let accountDailyId = account.id.toHexString() + "-" + day.toString();
  let accountDaily = AccountDaily.load(accountDailyId);

  if (!accountDaily) {
    accountDaily = new AccountDaily(accountDailyId);
    accountDaily.account = account.id;
    accountDaily.dayBuyVolume = BIGINT_ZERO;
    accountDaily.dayPriceChange = BIGINT_ZERO;
    accountDaily.daySellVolume = BIGINT_ZERO;
    accountDaily.day = day;
  }

  return accountDaily;
}

export function GetOrCreateAccount(address: Address): Account {
  let account = Account.load(address);

  if (!account) {
    let protocol = GetOrCreateProtocol();
    let protocolUserCount = protocol.userCount.plus(BIGINT_ONE);
    protocol.userCount = protocolUserCount;

    account = new Account(address);
    account.timestamp = BIGINT_ZERO;
    account.holdersCount = BIGINT_ZERO;
    account.tradesCount = BIGINT_ZERO;
    account.keySupply = BIGINT_ZERO;
    account.accountRevenue = BIGINT_ZERO;
    account.save();
    protocol.save();

  }

  return account as Account;
}

export function GetOrCreateHolding(holder: Account, subject: Account): Holding {
  let holding = Holding.load(holder.id.concat(subject.id));

  if (!holding) {
    holding = new Holding(holder.id.concat(subject.id));
    holding.timestamp = BIGINT_ZERO;
    holding.holder = holder.id; // Account!
    holding.subject = subject.id; // Account!
    holding.keysOwned = BIGINT_ZERO; // BigInt!

    holding.save();
  }

  return holding as Holding;
}

export function GetOrCreateProtocol(): Protocol {
  let protocol = Protocol.load(PROTOCOL);

  if (!protocol) {
    protocol = new Protocol(PROTOCOL);
    protocol.timestamp = BIGINT_ZERO;
    protocol.userCount = BIGINT_ZERO;
    protocol.protocolRevenue = BIGINT_ZERO;
    protocol.totalTrades = BIGINT_ZERO;
    protocol.tradeVolume = BIGINT_ZERO;
    protocol.accountRevenue = BIGINT_ZERO;
    protocol.save();
  }

  return protocol as Protocol;
}
