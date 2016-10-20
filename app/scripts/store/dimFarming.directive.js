(function() {
  'use strict';

  angular.module('dimApp').directive('dimFarming', Farming);

  function Farming() {
    return {
      controller: FarmingCtrl,
      controllerAs: 'vm',
      bindToController: true,
      scope: {},
      template: `
        <div ng-if="vm.service.active" id="item-farming">
          <span class="engram-icon">
            <div class="item-count">{{vm.service.itemsMoved}}</div>
            <img class="engram" ng-class="{ active: (vm.service.movingItems || vm.service.makingRoom) }" src="/images/engram.svg" height="60" width="60"/>
          </span>
          <span>
            <p>DIM is moving Engram and Glimmer items from {{vm.service.store.name}} to the vault and leaving one space open per item type to prevent anything from going to the Postmaster.</p>
            <div class="item-details"><span>
              <p>Configuration</p>
              <p><input id="farm-greens" type='checkbox' ng-model='vm.service.settings.farmGreens' /><label for="farm-greens">Farm Uncommon/Green Items</label></p>
            </span><span>
              <p>Quick Move</p>
              <p><dim-simple-item ng-repeat="item in vm.service.consolidate track by $index" item-data="item" ng-click="vm.consolidate(item, vm.service.store)"></dim-simple-item></p>
            </span></div>
          </span>
          <span><button ng-click="vm.stop($event)">Stop</button></span>
        </div>`
    };
  }

  FarmingCtrl.$inject = ['dimFarmingService', 'dimItemMoveService'];

  function FarmingCtrl(dimFarmingService, dimItemMoveService) {
    var vm = this;

    angular.extend(vm, {
      service: dimFarmingService,
      consolidate: dimItemMoveService.consolidate,
      stop: function($event) {
        $event.preventDefault();
        dimFarmingService.stop();
      }
    });
  }
})();
