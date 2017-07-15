import angular from 'angular';
import _ from 'underscore';
import { sum, flatMap } from '../util';
import template from './loadout-builder-item.html';
import dialogTemplate from './loadout-builder-item-dialog.html';
import Popper from 'popper.js';

export const LoadoutBuilderItem = {
  controller: LoadoutBuilderItemCtrl,
  controllerAs: 'vm',
  bindings: {
    itemData: '<',
    shiftClickCallback: '='
  },
  template: template
};

function LoadoutBuilderItemCtrl($scope, $element, ngDialog, dimStoreService) {
  'ngInject';

  const vm = this;
  let dialogResult = null;

  let dialog = null;
  $scope.$on('ngDialog.opened', (event, $dialog) => {
    dialog = $dialog;
    vm.reposition();
  });

  let popper;

  // TODO: gotta make a popup directive

  // Reposition the popup as it is shown or if its size changes
  vm.reposition = function() {
    if (dialogResult && dialog[0].id === dialogResult.id) {
      if (popper) {
        popper.scheduleUpdate();
      } else {
        popper = new Popper($element[0].getElementsByClassName('item')[0], dialog, {
          placement: 'top-start',
          eventsEnabled: false,
          modifiers: {
            preventOverflow: {
              priority: ['bottom', 'top', 'right', 'left']
            },
            flip: {
              behavior: ['top', 'bottom', 'right', 'left']
            },
            offset: {
              offset: '0,7px'
            },
            arrow: {
              element: '.arrow'
            }
          }
        });
        popper.scheduleUpdate(); // helps fix arrow position
      }
    }
  };

  angular.extend(vm, {
    itemClicked: function(item, e) {
      e.stopPropagation();

      if (dialogResult) {
        if (ngDialog.isOpen(dialogResult.id)) {
          dialogResult.close();
          dialogResult = null;
          popper.destroy();
          popper = null;
        }
      } else if (vm.shiftClickCallback && e.shiftKey) {
        vm.shiftClickCallback(vm.itemData);
      } else {
        const compareItems = flatMap(dimStoreService.getStores(), (store) => {
          return _.filter(store.items, { hash: item.hash });
        });

        const compareItemCount = sum(compareItems, 'amount');

        dialogResult = ngDialog.open({
          template: dialogTemplate,
          overlay: false,
          className: 'move-popup-dialog vendor-move-popup',
          showClose: false,
          scope: angular.extend($scope.$new(true), {
          }),
          controllerAs: 'vm',
          controller: [function() {
            const vm = this;
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

        dialogResult.closePromise.then(() => {
          dialogResult = null;
          popper.destroy();
          popper = null;
        });
      }
    },
    close: function() {
      if (dialogResult) {
        dialogResult.close();
      }
      $scope.closeThisDialog();
    },

    $onDestroy() {
      if (dialogResult) {
        dialogResult.close();
      }
      if (popper) {
        popper.destroy();
      }
    }
  });

}

