import { module } from 'angular';

import { StoresComponent } from './dimStores.directive';
import { StoreReputation } from './dimStoreReputation.directive';
import { tagIconFilter, StoreItemComponent } from './dimStoreItem.directive';
import { StoreHeadingComponent } from './dimStoreHeading.directive';
import { StoreBucketComponent } from './dimStoreBucket.directive';
import { StatsComponent } from './dimStats.directive';
import { SimpleItemComponent } from './dimSimpleItem.directive';
import { PercentWidth, percent } from './dimPercentWidth.directive';
import { StorePagerComponent } from './store-pager.component';
import { react2angular } from 'react2angular';
import ClearNewItems from './ClearNewItems';
import ItemIcon from './item-icon';

export default module('inventoryModule', [])
  .component('dimStores', StoresComponent)
  .component('storePager', StorePagerComponent)
  .component('dimStoreReputation', StoreReputation)
  .component('dimStoreHeading', StoreHeadingComponent)
  .component('dimStoreBucket', StoreBucketComponent)
  .component('dimStats', StatsComponent)
  .component('dimSimpleItem', SimpleItemComponent)
  .component('dimClearNewItems', react2angular(ClearNewItems, ['account']))
  .component('dimStoreItem', StoreItemComponent)
  .component('itemIcon', react2angular(ItemIcon, ['item']))
  .directive('dimPercentWidth', PercentWidth)
  .filter('tagIcon', tagIconFilter)
  .filter('percent', () => percent)
  .name;
