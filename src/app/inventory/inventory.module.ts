import { module } from 'angular';

import { InventoryComponent } from './inventory.component';
import { StoresComponent } from './dimStores.directive';
import { StoreReputation } from './dimStoreReputation.directive';
import { tagIconFilter, StoreItemComponent } from './dimStoreItem.directive';
import { StoreHeadingComponent } from './dimStoreHeading.directive';
import { StoreBucketComponent } from './dimStoreBucket.directive';
import { StatsComponent } from './dimStats.directive';
import { SimpleItemComponent } from './dimSimpleItem.directive';
import { PercentWidth, percent } from './dimPercentWidth.directive';
import { ClearNewItemsComponent } from './dimClearNewItems.directive';
import { StorePagerComponent } from './store-pager.component';
import { StateProvider } from '@uirouter/angularjs';

export default module('inventoryModule', [])
  .component('inventory', InventoryComponent)
  .component('dimStores', StoresComponent)
  .component('storePager', StorePagerComponent)
  .component('dimStoreReputation', StoreReputation)
  .component('dimStoreHeading', StoreHeadingComponent)
  .component('dimStoreBucket', StoreBucketComponent)
  .component('dimStats', StatsComponent)
  .component('dimSimpleItem', SimpleItemComponent)
  .component('dimClearNewItems', ClearNewItemsComponent)
  .component('dimStoreItem', StoreItemComponent)
  .directive('dimPercentWidth', PercentWidth)
  .filter('tagIcon', tagIconFilter)
  .filter('percent', () => percent)
  .config(($stateProvider: StateProvider) => {
    'ngInject';

    $stateProvider.state({
      name: 'destiny1.inventory',
      component: 'inventory',
      url: '/inventory'
    });
  })
  .name;
