import { subscribeOnScope } from '../rx-utils';
import { settings } from '../settings/settings';

import template from './vendors.html';
import './vendors.scss';
import { IComponentOptions, IController, IScope } from 'angular';
import { DestinyAccount } from '../accounts/destiny-account.service';
import { dimVendorService } from './vendor.service';
import { refresh$ } from '../shell/refresh';

export const VendorsComponent: IComponentOptions = {
  controller: VendorsController,
  template,
  bindings: {
    account: '<'
  },
  controllerAs: 'vm'
};

function VendorsController(
  this: IController & {
    account: DestinyAccount;
    settings: typeof settings;
  },
  $scope: IScope
) {
  'ngInject';

  const vm = this;

  vm.activeTab = 'hasArmorWeaps';
  vm.activeTypeDefs = {
    armorweaps: ['armor', 'weapons'],
    vehicles: ['ships', 'vehicles'],
    shadersembs: ['shaders', 'emblems'],
    emotes: ['emotes']
  };

  $scope.$watch(
    () => settings,
    () => {
      vm.settings = settings;
    }
  );

  this.$onInit = () => {
    subscribeOnScope($scope, dimVendorService.getVendorsStream(vm.account), ([stores, vendors]) => {
      vm.stores = stores;
      vm.vendors = vendors;
      vm.totalCoins = dimVendorService.countCurrencies(stores, vendors);
      dimVendorService.requestRatings().then(() => $scope.$apply());
    });
    subscribeOnScope($scope, refresh$, () => {
      dimVendorService.reloadVendors();
    });
  };
}
