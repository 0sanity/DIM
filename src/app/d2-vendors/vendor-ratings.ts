import { DestinyTrackerServiceType } from "../item-review/destiny-tracker.service";
import { DestinyVendorsResponse, DestinyVendorSaleItemComponent, DestinyVendorResponse, DestinyProfileResponse, DestinyVendorItemDefinition } from "bungie-api-ts/destiny2";
import * as _ from "underscore";
import { D2ManifestDefinitions } from "../destiny2/d2-definitions.service";

export async function fetchRatings(destinyTrackerService: DestinyTrackerServiceType,
                                   vendorsResponse?: DestinyVendorsResponse,
                                   vendorResponse?: DestinyVendorResponse,
                                   profileResponse?: DestinyProfileResponse,
                                   defs?: D2ManifestDefinitions): Promise<void> {
  if (vendorsResponse) {
    const saleComponentArray = Object.values(vendorsResponse.sales.data)
      .map((saleItemComponent) => saleItemComponent.saleItems);

    const saleComponents = ([] as DestinyVendorSaleItemComponent[]).concat(...saleComponentArray.map((v) => Object.values(v)));

    await destinyTrackerService.bulkFetchVendorItems(saleComponents);
  } else if (vendorResponse) {
    const saleComponents = Object.values(vendorResponse.sales.data);

    await destinyTrackerService.bulkFetchVendorItems(saleComponents);
  } else if (profileResponse && defs) {
    const vendorItems: DestinyVendorItemDefinition[] = [];

    const kioskVendorHashes = new Set(Object.keys(profileResponse.profileKiosks.data.kioskItems));
    _.each(profileResponse.characterKiosks.data, (kiosk) => {
      _.each(kiosk.kioskItems, (_, kioskHash) => {
        kioskVendorHashes.add(kioskHash);
      });
    });

    Array.from(kioskVendorHashes).map((kvh) => {
      const vendorDef = defs.Vendor.get(Number(kvh));
      vendorItems.concat(vendorDef.itemList);
    });

    await destinyTrackerService.bulkFetchVendorItems(undefined, vendorItems);
  } else {
    throw new Error("No response was supplied.");
  }
}
