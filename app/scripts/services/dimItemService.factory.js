(function() {
  'use strict';

  angular.module('dimApp')
    .factory('dimItemService', ItemService);

  ItemService.$inject = ['dimStoreService', 'dimBungieService', 'dimCategory', '$q'];

  function ItemService(dimStoreService, dimBungieService, dimCategory, $q) {
    // We'll reload the stores to check if things have been
    // thrown away or moved and we just don't have up to date info. But let's
    // throttle these calls so we don't just keep refreshing over and over.
    // This needs to be up here because of how we return the service object.
    var throttledReloadStores = _.throttle(function() {
      return dimStoreService.reloadStores();
    }, 10000, { trailing: false });

    return {
      getSimilarItem: getSimilarItem,
      getItem: getItem,
      getItems: getItems,
      moveTo: moveTo,
      equipItems: equipItems,
      setItemState: setItemState
    };

    function setItemState(item, store, lockState, type) {
      return dimBungieService.setItemState(item, store, lockState, type)
        .then(() => lockState);
    }

    /**
     * Update our item and store models after an item has been moved (or equipped/dequipped).
     * @return the new or updated item (it may create a new item!)
     */
    function updateItemModel(item, source, target, equip, amount) {
      // Refresh all the items - they may have been reloaded!
      source = dimStoreService.getStore(source.id);
      target = dimStoreService.getStore(target.id);
      item = getItem(item);

      // If we've moved to a new place
      if (source.id !== target.id) {
        // We handle moving stackable and nonstackable items almost exactly the same!
        var stackable = item.maxStackSize > 1;
        // Items to be decremented
        var sourceItems = stackable
              ? _.sortBy(_.select(source.items, function(i) {
                return i.hash === item.hash &&
                  i.id === item.id &&
                  !i.notransfer;
              }), 'amount') : [item];
        // Items to be incremented. There's really only ever at most one of these, but
        // it's easier to deal with as a list.
        var targetItems = stackable
              ? _.sortBy(_.select(target.items, function(i) {
                return i.hash === item.hash &&
                  i.id === item.id &&
                  // Don't consider full stacks as targets
                  i.amount !== i.maxStackSize &&
                  !i.notransfer;
              }), 'amount') : [];
        // moveAmount could be more than maxStackSize if there is more than one stack on a character!
        var moveAmount = amount || item.amount;
        var addAmount = moveAmount;
        var removeAmount = moveAmount;
        var removedSourceItem = false;

        // Remove inventory from the source
        while (removeAmount > 0) {
          var sourceItem = sourceItems.shift();
          if (!sourceItem) {
            throw new Error("Looks like you requested to move more of this item than exists in the source!");
          }

          var amountToRemove = Math.min(removeAmount, sourceItem.amount);
          if (amountToRemove === sourceItem.amount) {
            // Completely remove the source item
            if (source.removeItem(sourceItem)) {
              removedSourceItem = sourceItem.index === item.index;
            }
          } else {
            sourceItem.amount -= amountToRemove;
          }

          removeAmount -= amountToRemove;
        }

        // Add inventory to the target (destination)
        var targetItem;
        while (addAmount > 0) {
          targetItem = targetItems.shift();

          if (!targetItem) {
            targetItem = item;
            if (!removedSourceItem) {
              targetItem = angular.copy(item);
              targetItem.index = dimStoreService.createItemIndex(targetItem);
            }
            removedSourceItem = false; // only move without cloning once
            targetItem.amount = 0; // We'll increment amount below
            target.addItem(targetItem);
          }

          var amountToAdd = Math.min(addAmount, targetItem.maxStackSize - targetItem.amount);
          targetItem.amount += amountToAdd;
          addAmount -= amountToAdd;
        }
        item = targetItem; // The item we're operating on switches to the last target
      }

      if (equip) {
        var equipped = _.find(target.buckets[item.location.id], { equipped: true });
        if (equipped) {
          equipped.equipped = false;
        }
        item.equipped = true;
      }

      return item;
    }

    function getSimilarItem(item, exclusions) {
      var target = dimStoreService.getStore(item.owner);
      var sortedStores = _.sortBy(dimStoreService.getStores(), function(store) {
        if (target.id === store.id) {
          return 0;
        } else if (store.isVault) {
          return 1;
        } else {
          return 2;
        }
      });

      var result = null;
      sortedStores.find(function(store) {
        result = searchForSimilarItem(item, store, exclusions, target);
        return result !== null;
      });

      return result;
    }

    /**
     * Find an item in store like "item", excluding the exclusions, to be equipped
     * on target.
     * @param exclusions a list of {id, hash} objects that won't be considered for equipping.
     */
    function searchForSimilarItem(item, store, exclusions, target) {
      exclusions = exclusions || [];

      var candidates = _.filter(store.items, function(i) {
        return i.canBeEquippedBy(target) &&
          i.location.id === item.location.id &&
          !i.equipped &&
          // Not the same item
          i.id !== item.id &&
          // Not on the exclusion list
          !_.any(exclusions, { id: i.id, hash: i.hash });
      });

      if (!candidates.length) {
        return null;
      }

      // TODO: unify this value function w/ the others!
      var result = _.max(candidates, function(i) {
        var value = {
          Legendary: 4,
          Rare: 3,
          Uncommon: 2,
          Common: 1,
          Exotic: 0
        }[i.tier];
        if (i.primStat) {
          value += i.primStat.value / 1000.0;
        }
        return value;
      });

      if (result && result.isExotic) {
        var prefix = _.filter(store.items, function(i) {
          return i.equipped &&
            i.bucket.sort === item.bucket.sort &&
            i.isExotic;
        });

        if (prefix.length === 0) {
          return result;
        } else {
          return null;
        }
      }

      return result || null;
    }

    /**
     * Bulk equip items. Only use for multiple equips at once.
     */
    function equipItems(store, items) {
      // Check for (and move aside) exotics
      const extraItemsToEquip = _.compact(items.map((i) => {
        if (i.isExotic) {
          const otherExotic = getOtherExoticThatNeedsDequipping(i, store);
          // If we aren't already equipping into that slot...
          if (otherExotic && !_.find(items, { type: otherExotic.type })) {
            const similarItem = getSimilarItem(otherExotic);
            if (!similarItem) {
              return $q.reject(new Error('Cannot find another item to equip in order to dequip ' + otherExotic.name));
            }
            const target = dimStoreService.getStore(similarItem.owner);

            if (store.id === target.id) {
              return similarItem;
            } else {
              // If we need to get the similar item from elsewhere, do that first
              return moveTo(similarItem, store, true).then(() => similarItem);
            }
          }
        }
        return undefined;
      }));

      return $q.all(extraItemsToEquip).then((extraItems) => {
        items = items.concat(extraItems);

        if (items.length === 1) {
          return equipItem(items[0]);
        }
        return dimBungieService.equipItems(store, items)
          .then(function(equippedItems) {
            return equippedItems.map(function(i) {
              return updateItemModel(i, store, store, true);
            });
          });
      });
    }

    function equipItem(item) {
      return dimBungieService.equip(item)
        .then(function() {
          const store = dimStoreService.getStore(item.owner);
          return updateItemModel(item, store, store, true);
        });
    }

    function dequipItem(item) {
      const similarItem = getSimilarItem(item);
      if (!similarItem) {
        return $q.reject(new Error('Cannot find another item to equip in order to dequip ' + item.name));
      }
      const source = dimStoreService.getStore(item.owner);
      const target = dimStoreService.getStore(similarItem.owner);

      let p = $q.when();
      if (source.id !== target.id) {
        p = moveTo(similarItem, source, true);
      }

      return p.then(() => equipItem(similarItem));
    }

    function moveToVault(item, amount) {
      return moveToStore(item, dimStoreService.getVault(), false, amount);
    }

    function moveToStore(item, store, equip, amount) {
      return dimBungieService.transfer(item, store, amount)
        .then(function() {
          var source = dimStoreService.getStore(item.owner);
          return updateItemModel(item, source, store, false, amount);
        });
    }

    /**
     * This returns a promise for true if the exotic can be
     * equipped. In the process it will move aside any existing exotic
     * that would conflict. If it could not move aside, this
     * rejects. It never returns false.
     */
    function canEquipExotic(item, store) {
      const otherExotic = getOtherExoticThatNeedsDequipping(item, store);
      if (otherExotic) {
        return dequipItem(otherExotic)
          .then(() => true)
          .catch(function() {
            throw new Error('\'' + item.name + '\' cannot be equipped because the exotic in the ' + otherExotic.type + ' slot cannot be unequipped.');
          });
      } else {
        return $q.resolve(true);
      }
    }

    /**
     * Identify the other exotic, if any, that needs to be moved
     * aside. This is not a promise, it returns immediately.
     */
    function getOtherExoticThatNeedsDequipping(item, store) {
      const equippedExotics = _.filter(store.items, (i) => {
        return (i.equipped &&
                i.location.id !== item.location.id &&
                i.location.sort === item.location.sort &&
                i.isExotic);
      });

      if (equippedExotics.length === 0) {
        return null;
      } else if (equippedExotics.length === 1) {
        const equippedExotic = equippedExotics[0];

        if (item.hasLifeExotic() || equippedExotic.hasLifeExotic()) {
          return null;
        } else {
          return equippedExotic;
        }
      } else if (equippedExotics.length === 2) {
        // Assume that only one of the equipped items has 'The Life Exotic' perk
        const hasLifeExotic = item.hasLifeExotic();
        return _.find(equippedExotics, (i) => {
          return hasLifeExotic ? i.hasLifeExotic() : !i.hasLifeExotic();
        });
      } else {
        throw new Error("We don't know how you got more than 2 equipped exotics!");
      }
    }

    /**
     * Choose another item that we can move out of "store" in order to
     * make room for "item".
     * @param store the store to choose a move aside item from.
     * @param item the item we're making space for.
     * @param moveContext a helper object that can answer questions about how much space is left.
     */
    function chooseMoveAsideItem(store, item, moveContext) {
      // Check whether an item cannot or should not be moved
      function moveable(otherItem) {
        return !otherItem.notransfer && !_.any(moveContext.excludes, { id: otherItem.id, hash: otherItem.hash });
      }

      var moveAsideCandidates;
      var otherStores = _.reject(dimStoreService.getStores(), { id: store.id });
      if (store.isVault && !_.any(otherStores, (s) => moveContext.spaceLeft(s, item))) {
        // If we're trying to make room in the vault, and none of the
        // other stores have space for the same type, we can still get
        // rid of anything in the same sort category. Pick whatever
        // we have the most space for on some other guardian.
        const typesInCategory = dimCategory[item.bucket.sort];
        var bestTypes = _.sortby(typesInCategory, (type) => {
          return _.max(otherStores.map((otherStore) => {
            var vaultItem = _.find(store.items, { type: type });
            // TODO: reduce the value of the item's owner?
            return vaultItem ? moveContext.spaceLeft(otherStore, vaultItem) : 0;
          }));
        });

        bestTypes.find((type) => {
          moveAsideCandidates = _.filter(store.items, (otherItem) =>
                                         otherItem.type === type &&
                                         moveable(otherItem));
          // Stop once we have actual candidates, otherwise try another type
          return moveAsideCandidates.length > 0;
        });
      } else {
        moveAsideCandidates = _.filter(store.items, (otherItem) =>
                                       otherItem.location.id === item.location.id &&
                                       moveable(otherItem));
      }

      if (moveAsideCandidates.length === 0) {
        throw new Error(`There's nothing we can move out of ${store.name} to make room for ${item.name}`);
      }

      // For the vault, try to move the highest-value item to a character. For a
      // character, move the lowest-value item to the vault (or another character).
      // We move the highest-value item out of the vault because it seems better
      // not to gunk up characters with garbage or year 1 stuff.
      var moveAsideItem = _[store.isVault ? 'max' : 'min'](moveAsideCandidates, function(i) {
        // Lower means more likely to get moved away
        // Prefer not moving the equipped item
        var value = i.equipped ? 10 : 0;
        // Prefer moving lower-tier
        value += {
          Common: 0,
          Uncommon: 1,
          Rare: 2,
          Legendary: 3,
          Exotic: 4
        }[i.tier];
        // Prefer things this character can use
        if (!store.isVault && i.canBeEquippedBy(store)) {
          value += 5;
        }
        // And low-stat
        if (i.primStat) {
          value += i.primStat.value / 1000.0;
        }
        return value;
      });

      return moveAsideItem;
    }

    /**
     * Given an item we want to move, choose where to put it.
     * @param store the store we're moving aside from (moveAsideItem's owner).
     * @param item the item we're going to move.
     * @param moveContext a helper object that can answer questions about how much space is left.
     */
    function chooseMoveAsideTarget(store, moveAsideItem, moveContext) {
      var moveAsideTarget;
      var otherStores = _.reject(dimStoreService.getStores(), { id: store.id });
      if (store.isVault) {
        // Find the character with the most space
        moveAsideTarget = _.max(otherStores, (otherStore) => moveContext.spaceLeft(otherStore, moveAsideItem));
      } else {
        var vault = dimStoreService.getVault();
        // Prefer moving to the vault
        if (moveContext.spaceLeft(vault, moveAsideItem) > 0) {
          moveAsideTarget = vault;
        } else {
          moveAsideTarget = _.max(otherStores, (otherStore) => moveContext.spaceLeft(otherStore, moveAsideItem));
          if (moveAsideTarget !== -Infinity && moveContext.spaceLeft(moveAsideTarget, moveAsideItem) <= 0) {
            moveAsideTarget = vault;
          }
        }
      }
      return moveAsideTarget === -Infinity ? undefined : moveAsideTarget;
    }

    /**
     * Is there anough space to move the given item into store? This will refresh
     * data and/or move items aside in an attempt to make a move possible.
     * @return a promise that's either resolved if the move can proceed or rejected with an error.
     */
    function canMoveToStore(item, store, triedFallback, excludes) {
      if (item.owner === store.id) {
        return $q.resolve(true);
      }

      var stores = dimStoreService.getStores();

      // How much space will be needed (in amount, not stacks) in the target store in order to make the transfer?
      var storeReservations = {};
      stores.forEach(function(s) {
        storeReservations[s.id] = (s.id === store.id ? item.amount : 0);
      });

      // guardian-to-guardian transfer will also need space in the vault
      if (item.owner !== 'vault' && !store.isVault) {
        storeReservations.vault = item.amount;
      }

      // How many moves (in amount, not stacks) are needed from each
      var movesNeeded = {};
      stores.forEach(function(s) {
        movesNeeded[s.id] = Math.max(0, storeReservations[s.id] - s.spaceLeftForItem(item));
      });

      if (!_.any(movesNeeded)) {
        return $q.resolve(true);
      } else if (store.isVault || triedFallback) {
        // Move aside one of the items that's in the way
        var moveContext = {
          reservations: storeReservations,
          originalItemType: item.type,
          excludes: excludes || [],
          spaceLeft: function(s, i) {
            var left = s.spaceLeftForItem(i);
            if (i.type === this.originalItemType) {
              left = left - this.reservations[s.id];
            }
            return Math.max(0, left);
          }
        };

        // Move starting from the vault (which is always last)
        var moves = _.pairs(movesNeeded)
              .reverse()
              .find(([_, moveAmount]) => moveAmount > 0);
        var moveAsideSource = dimStoreService.getStore(moves[0]);
        var moveAsideItem = chooseMoveAsideItem(moveAsideSource, item, moveContext);
        var moveAsideTarget = chooseMoveAsideTarget(moveAsideSource, moveAsideItem, moveContext);

        if (!moveAsideTarget || (!moveAsideTarget.isVault && moveAsideTarget.spaceLeftForItem(moveAsideItem) <= 0)) {
          const error = new Error(`There are too many '${(moveAsideTarget.isVault ? moveAsideItem.bucket.sort : moveAsideItem.type)}' items in the ${moveAsideTarget.name}.`);
          error.code = 'no-space';
          return $q.reject(error);
        } else {
          // Make one move and start over!
          return moveTo(moveAsideItem, moveAsideTarget, false, moveAsideItem.amount, excludes)
            .then(function() {
              return canMoveToStore(item, store, triedFallback, excludes);
            });
        }
      } else {
        // Refresh the stores to see if anything has changed
        var reloadPromise = throttledReloadStores() || $q.when(dimStoreService.getStores());
        return reloadPromise.then(function(stores) {
          store = _.find(stores, { id: store.id });
          return canMoveToStore(item, store, true, excludes);
        });
      }
    }

    function canEquip(item, store) {
      return $q(function(resolve, reject) {
        if (item.canBeEquippedBy(store)) {
          resolve(true);
        } else if (item.classified) {
          reject(new Error("This item is classified and can not be transferred at this time."));
        } else {
          reject(new Error("This can only be equipped on " + (item.classTypeName === 'unknown' ? 'character' : item.classTypeName) + "s at or above level " + item.equipRequiredLevel + "."));
        }
      });
    }

    /**
     * Check whether this transfer can happen. If necessary, make secondary inventory moves
     * in order to make the primary transfer possible, such as making room or dequipping exotics.
     */
    function isValidTransfer(equip, store, item, excludes) {
      var promises = [];

      if (equip) {
        promises.push(canEquip(item, store));
        if (item.isExotic) {
          promises.push(canEquipExotic(item, store));
        }
      }

      promises.push(canMoveToStore(item, store, false, excludes));

      return $q.all(promises);
    }

    /**
     * Move item to target store, optionally equipping it.
     * @param item the item to move.
     * @param target the store to move it to.
     * @param equip true to equip the item, false to leave it unequipped.
     * @param amount how much of the item to move (for stacks). Can span more than one stack's worth.
     * @param excludes A list of {id, hash} objects representing items that should not be moved aside to make the move happen.
     */
    function moveTo(item, target, equip, amount, excludes) {
      return isValidTransfer(equip, target, item, excludes)
        .then(function() {
          // Replace the target store - isValidTransfer may have reloaded it
          const target = dimStoreService.getStore(target.id);
          const source = dimStoreService.getStore(item.owner);

          let promise = $q.when(item);

          if (!source.isVault && !target.isVault) { // Guardian to Guardian
            if (source.id !== target.id) { // Different Guardian
              if (item.equipped) {
                promise = promise.then(() => dequipItem(item));
              }

              promise = promise
                .then(() => moveToVault(item, amount))
                .then((item) => moveToStore(item, target, equip, amount));
            }

            if (equip) {
              promise = promise.then(() => (item.equipped ? item : equipItem(item)));
            } else if (!equip) {
              promise = promise.then(() => (item.equipped ? dequipItem(item) : item));
            }
          } else if (source.isVault && target.isVault) { // Vault to Vault
            // Do Nothing.
          } else if (source.isVault || target.isVault) { // Guardian to Vault
            if (item.equipped) {
              promise = promise.then(() => dequipItem(item));
            }

            promise = promise.then(() => moveToStore(item, target, equip, amount));
          }

          return promise;
        });
    }

    function getItems() {
      var returnValue = [];
      dimStoreService.getStores().forEach(function(store) {
        returnValue = returnValue.concat(store.items);
      });
      return returnValue;
    }

    function getItem(params, store) {
      var items = store ? store.items : getItems();
      return _.findWhere(items, _.pick(params, 'id', 'hash', 'notransfer'));
    }
  }
})();
