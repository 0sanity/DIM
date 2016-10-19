(function() {
  'use strict';

  var VendorItem = {
    bindings: {
      saleItem: '<',
      costs: '<',
      totalCoins: '<',
      isUnlocked: '<',
      itemClicked: '&'
    },
    template: [
      '<div class="vendor-item">',
      '  <div ng-if="!$ctrl.isUnlocked" class="locked-overlay"></div>',
      '  <dim-simple-item id="vendor-{{::$ctrl.saleItem.hash}}" item-data="$ctrl.saleItem" ng-click="$ctrl.itemClicked({ $event: $event })" ng-class="{ \'search-hidden\': !$ctrl.saleItem.visible }"></dim-simple-item>',
      '  <div ng-repeat="cost in $ctrl.costs" class="cost" ng-class="{notenough: ($ctrl.totalCoins[cost.currency.itemHash] < cost.value)}">',
      '    {{::cost.value}}/{{$ctrl.totalCoins[cost.currency.itemHash]}}',
      '    <span class="currency"><img ng-src="{{::cost.currency.icon | bungieIcon}}" title="{{::cost.currency.itemName}}"></span>',
      '  </div>',
      '</div>'
    ].join('')
  };

  var VendorItems = {
    controller: VendorItemsCtrl,
    controllerAs: 'vm',
    bindings: {
      stores: '<storesData',
      vendors: '=vendorsData',
      types: '<displayTypes',
      totalCoins: '<totalCoins',
      activeTab: '<activeTab'
    },
    template: [
      '<div class="vendor-char-items" ng-repeat="vendor in vm.vendors | values | vendorTab:vm.activeTab | orderBy:[\'-eventVendor\',\'vendorOrder\'] track by vendor.hash">',
      '   <div class="vendor-header">',
      '     <div class="title">',
      '     {{vendor.name}}',
      '     <img class="vendor-icon" ng-src="{{::vendor.icon | bungieIcon}}" />',
      '     <timer class="vendor-timer" ng-if="vendor.nextRefreshDate[0] !== \'9\'" end-time="vendor.nextRefreshDate" max-time-unit="\'day\'" interval="1000">{{days}} day{{daysS}} {{hhours}}:{{mminutes}}:{{sseconds}}</timer>',
      '     </div>',
      '   </div>',
      '   <div class="vendor-row">',
      '     <div class="char-cols">',
      '       <div ng-repeat="category in vendor.categories | vendorTab:vm.activeTab track by category.index">',
      '          <h3>{{category.title}}</h3>',
      '          <div class="vendor-items">',
      '            <dim-vendor-item ng-repeat="saleItem in category.saleItems" sale-item="saleItem.item" costs="saleItem.costs" is-unlocked="saleItem.unlocked" total-coins="vm.totalCoins" item-clicked="vm.itemClicked(saleItem.item, $event)"></dim-vendor-item>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '</div>'
    ].join('')
  };

  angular.module('dimApp')
    .component('dimVendorItem', VendorItem)
    .component('dimVendorItems', VendorItems)
    .filter('vendorTab', function() {
      // TODO: filter item categories?
      return function vendorTab(categories, prop) {
        return _.filter(categories, prop);
      };
    })
    .filter('values', function() {
      return function values(obj) {
        return _.values(obj);
      };
    });

  // TODO: separate out class-specific stuff?

  VendorItemsCtrl.$inject = ['$scope', 'ngDialog', 'dimStoreService', 'dimSettingsService'];

  function VendorItemsCtrl($scope, ngDialog, dimStoreService, dimSettingsService) {
    var vm = this;
    var dialogResult = null;
    var detailItem = null;
    var detailItemElement = null;

    vm.settings = dimSettingsService;

    $scope.$on('ngDialog.opened', function(event, $dialog) {
      if (dialogResult && $dialog[0].id === dialogResult.id) {
        $dialog.position({
          my: 'left top',
          at: 'left bottom+2',
          of: detailItemElement,
          collision: 'flip flip'
        });
      }
    });

    angular.extend(vm, {
      eachHasItems: function(items, types) {
        return types.length > 1 && _.every(types, function(type) { return items[type].length; });
      },
      getFirstVendorCombined: function(vendors, vendorHash) {
        if (vendors) {
          const vendor = _.find(vendors, function(vendor) {
            return vendor[vendorHash];
          });
          if (vendor) {
            return vendor[vendorHash];
          }
        }
        return null;
      },
      itemClicked: function(item, e) {
        e.stopPropagation();
        if (dialogResult) {
          dialogResult.close();
        }

        if (detailItem === item) {
          detailItem = null;
          dialogResult = null;
          detailItemElement = null;
        } else {
          detailItem = item;
          detailItemElement = angular.element(e.currentTarget);

          var compareItems = _.flatten(dimStoreService.getStores().map(function(store) {
            return _.filter(store.items, { hash: item.hash });
          }));

          var compareItemCount = sum(compareItems, 'amount');

          dialogResult = ngDialog.open({
            template: [
              '<div class="move-popup" dim-click-anywhere-but-here="closeThisDialog()">',
              '  <div dim-move-item-properties="vm.item" dim-compare-item="vm.compareItem"></div>',
              '  <div class="item-details more-item-details" ng-if="vm.item.equipment && vm.compareItems.length">',
              '    <div>Compare with what you already have:</div>',
              '    <div class="compare-items">',
              '      <dim-simple-item ng-repeat="ownedItem in vm.compareItems track by ownedItem.index" item-data="ownedItem" ng-click="vm.setCompareItem(ownedItem)" ng-class="{ selected: (ownedItem.index === vm.compareItem.index) }"></dim-simple-item>',
              '    </div>',
              '  </div>',
              '  <div class="item-description" ng-if="!vm.item.equipment">You have {{vm.compareItemCount}} of these.</div>',
              '</div>'].join(''),
            plain: true,
            overlay: false,
            className: 'move-popup vendor-move-popup',
            showClose: false,
            scope: angular.extend($scope.$new(true), {
            }),
            controllerAs: 'vm',
            controller: [function() {
              var vm = this;
              angular.extend(vm, {
                item: item,
                compareItems: compareItems,
                compareItem: _.first(compareItems),
                compareItemCount: compareItemCount,
                setCompareItem: function(item) {
                  this.compareItem = item;
                }
              });
            }],
            // Setting these focus options prevents the page from
            // jumping as dialogs are shown/hidden
            trapFocus: false,
            preserveFocus: false
          });
        }
      },
      close: function() {
        if (dialogResult) {
          dialogResult.close();
        }
        $scope.closeThisDialog();
      }
    });
  }
})();
