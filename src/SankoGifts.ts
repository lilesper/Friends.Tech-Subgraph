import { Minted as MintEvent } from "../generated/SankoTVGifts/SankoTips";
import { Tip } from "../generated/schema";
import { GetOrCreateAccount, GetOrCreateProtocol } from "./helpers";

export function handleMint(event: MintEvent): void {
    let protocol = GetOrCreateProtocol();
    protocol.protocolRevenue = protocol.protocolRevenue.plus(event.params.protocolFee);
    protocol.save()
    let gifter = GetOrCreateAccount(event.params.gifter);
    let streamer = GetOrCreateAccount(event.params.streamer);
    streamer.accountRevenue = streamer.accountRevenue.plus(event.params.totalPrice).minus(event.params.protocolFee)
    gifter.accountGifts = gifter.accountGifts.plus(event.params.totalPrice)
    let tip = new Tip(event.transaction.hash.concatI32(event.logIndex.toI32()));
    tip.gifter = event.params.gifter;
    tip.amount = event.params.amount;
    tip.giftId = event.params.giftId;
    tip.protocolFee = event.params.protocolFee;
    tip.streamer = event.params.streamer;
    tip.totalPrice = event.params.totalPrice;
    tip.save()
    gifter.save()
    streamer.save()
}
