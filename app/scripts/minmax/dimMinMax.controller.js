(function() {
  'use strict';

  angular.module('dimApp')
    .controller('dimMinMaxCtrl', dimMinMaxCtrl);

  dimMinMaxCtrl.$inject = ['$scope', '$state', '$q', '$timeout', '$location', 'loadingTracker', 'dimStoreService', 'dimItemService', 'ngDialog', 'dimLoadoutService'];

  function dimMinMaxCtrl($scope, $state, $q, $timeout, $location, loadingTracker, dimStoreService, dimItemService, ngDialog, dimLoadoutService) {
    var vm = this, buckets = [];

    function getBonusType(armorpiece) {
      return '' +
        (armorpiece.normalStats[144602215].bonus > 0? 'int ' : '') +
        (armorpiece.normalStats[1735777505].bonus > 0? 'disc ' : '') +
        (armorpiece.normalStats[4244567218].bonus > 0? 'str' : '');
    }

    function getBestItem(armor, stats, type, nonExotic) {
      return {
        item: _.max(armor, function(o) {
          if (nonExotic && o.isExotic) {
            return 0;
          }
          var bonus = 0,
              total = 0;
          stats.forEach(function(stat) {
            total += o.normalStats[stat][vm.scale_type];
            bonus = o.normalStats[stat].bonus;
          });
          return total + bonus;
        }),
        bonus_type: type
      };
    }

    function getBestArmor(bucket, locked) {
      var armor = {};
      var best = [], best_non_exotic = [];
      for (var armortype in bucket) {
        if(locked[armortype] !== null) {
          best = [{item: locked[armortype], bonus_type: getBonusType(locked[armortype])}];
        } else {
          best = [
            getBestItem(bucket[armortype], [144602215, 1735777505], 'intdisc'), // best int + bonus + dis
            getBestItem(bucket[armortype], [144602215, 4244567218], 'intstr'), // best int + bonus + str
            getBestItem(bucket[armortype], [1735777505, 4244567218], 'discstr'), // best dis + bonus + str
          ];
          if(vm.mode) {
            best = best.concat([
              getBestItem(bucket[armortype], [144602215], 'int'), // best int + bonus
              getBestItem(bucket[armortype], [1735777505], 'disc'), // best int + bonus
              getBestItem(bucket[armortype], [4244567218], 'str'), // best int + bonus
            ]);
          }

          if(armortype !== 'ClassItem') {
            // Best needs to include a non-exotic if the max is an exotic item
            best_non_exotic = [];
            var i = 0;
            if(best[i++].item.isExotic) {
                best_non_exotic.push(getBestItem(bucket[armortype], [144602215, 1735777505], ''));
            }
            if(best[i++].item.isExotic) {
                best_non_exotic.push(getBestItem(bucket[armortype], [144602215, 4244567218], ''));
            }
            if(best[i++].item.isExotic) {
                best_non_exotic.push(getBestItem(bucket[armortype], [1735777505, 4244567218], ''));
            }
            if(vm.mode) {
              var stat_hashes = [144602215, 1735777505, 4244567218];
              for(; i < 6; ++i) {
                if(best[i].item.isExotic) {
                  best_non_exotic.push(getBestItem(bucket[armortype], [stat_hashes[i-3]], ''));
                }
              }
            }
            best = best.concat(best_non_exotic);
          }
        }

        var unique_objs = _.uniq(best, false, function(o) { return o.item.index; });
        var best_combs = [];

        _.each(unique_objs, function(obj) {
          obj.bonus_type = getBonusType(obj.item);
          if(obj.bonus_type.indexOf('int') > -1) {
            best_combs.push({item: obj.item, bonus_type: 'int'});
          }
          if (obj.bonus_type.indexOf('disc') > -1) {
            best_combs.push({item: obj.item, bonus_type: 'disc'});
          }
          if (obj.bonus_type.indexOf('str') > -1) {
            best_combs.push({item: obj.item, bonus_type: 'str'});
          }
        });
        armor[armortype] = best_combs;
      }
      return armor;
    }

    function validSet(gearset) {
      return (
        gearset.Helmet.item.isExotic +
        gearset.Gauntlets.item.isExotic +
        gearset.Chest.item.isExotic +
        gearset.Leg.item.isExotic
      ) < 2;
    }

    function getBuckets(items) {
      function normalizeStats(item) {
        item.normalStats = {};
        _.each(item.stats, function(stat) {
          item.normalStats[stat.statHash] = {
            statHash: stat.statHash,
            base: stat.base,
            scaled: stat.scaled ? stat.scaled.min : 0,
            bonus: stat.bonus,
            split: stat.split,
            qualityPercentage: stat.qualityPercentage ? stat.qualityPercentage.min : 0
          };
        });
        return item;
      }

      // load the best items
      return {
        Helmet: items.filter(function(item) { return item.type === 'Helmet'; }).map(normalizeStats),
        Gauntlets: items.filter(function(item) { return item.type === 'Gauntlets'; }).map(normalizeStats),
        Chest: items.filter(function(item) { return item.type === 'Chest'; }).map(normalizeStats),
        Leg: items.filter(function(item) { return item.type === 'Leg'; }).map(normalizeStats),
        ClassItem: items.filter(function(item) { return item.type === 'ClassItem'; }).map(normalizeStats),
        Ghost: items.filter(function(item) { return item.type === 'Ghost'; }).map(normalizeStats),
        Artifact: items.filter(function(item) { return item.type === 'Artifact'; }).map(normalizeStats)
      };
    }

    function initBuckets(items) {
      function loadBucket(classType) {
        return getBuckets(items.filter(function(item) {
          return item.classType === classType || item.classType === 3;
        }));
      }
      return {
        titan: loadBucket(0),
        hunter: loadBucket(1),
        warlock: loadBucket(2)
      };
    }

    angular.extend(vm, {
      active: 'warlock',
      activesets: '5/5/1',
      progress: 0,
      mode: false,
      scale_type: 'scaled',
      allSetTiers: [],
      highestsets: {},
      lockeditems: { Helmet: null, Gauntlets: null, Chest: null, Leg: null, ClassItem: null, Artifact: null, Ghost: null },
      normalize: 335,
      type: 'Helmet',
      showBlues: false,
      showExotics: true,
      showYear1: false,
      combinations: null,
      setOrder: '-str_val,-disc_val,-int_val',
      setOrderValues: ['-str_val', '-disc_val', '-int_val'],
      statOrder: '-stats.STAT_INTELLECT.value',
      ranked: {},
      lockedItemsValid: function(dropped_id, dropped_type) {
        dropped_id = dropped_id.split('-')[1];
        var item = _.findWhere(buckets[vm.active][dropped_type], {id: dropped_id});
        var exoticCount = ((item.isExotic && item.type !== 'ClassItem') ? 1 : 0);
        _.each(vm.lockeditems, function(lockeditem) {
          if(lockeditem === null || type === dropped_type) {
            return;
          }
          if(lockeditem.isExotic && lockeditem.type !== 'ClassItem') {
            exoticCount += 1;
          }
        });
        return exoticCount < 2;
      },
      onCharacterChange: function() {
        vm.ranked = buckets[vm.active];
        vm.lockeditems = { Helmet: null, Gauntlets: null, Chest: null, Leg: null, ClassItem: null, Artifact: null, Ghost: null };
        vm.highestsets = vm.getSetBucketsStep(vm.active);
      },
      onModeChange: function () {
        if(vm.progress <= 1) {
          vm.highestsets = vm.getSetBucketsStep(vm.active);
        }
      },
      onOrderChange: function () {
        vm.setOrderValues = vm.setOrder.split(',');
      },
      onDrop: function(dropped_id, type) {
        dropped_id = dropped_id.split('-')[1];
        if(vm.lockeditems[type] && vm.lockeditems[type].id === dropped_id) {
          return;
        }
        var item = _.findWhere(buckets[vm.active][type], {id: dropped_id});
        vm.lockeditems[type] = item;
        vm.highestsets = vm.getSetBucketsStep(vm.active);
        if(vm.progress < 1.0) {
          vm.lockedchanged = true;
        }
      },
      onRemove: function(removed_type) {
        vm.lockeditems[removed_type] = null;

        vm.highestsets = vm.getSetBucketsStep(vm.active);
        if(vm.progress < 1.0) {
          vm.lockedchanged = true;
        }
      },
      newLoadout: function(set) {
        ngDialog.closeAll();
        var loadout = { items: {} };
        var items = _.pick(set.armor, 'Helmet', 'Chest', 'Gauntlets', 'Leg', 'ClassItem', 'Ghost', 'Artifact');
        loadout.items.helmet = [items.Helmet.item];
        loadout.items.chest = [items.Chest.item];
        loadout.items.gauntlets = [items.Gauntlets.item];
        loadout.items.leg = [items.Leg.item];
        loadout.items.classitem = [items.ClassItem.item];
        loadout.items.ghost = [items.Ghost.item];
        loadout.items.artifact = [items.Artifact.item];
        loadout.classType = ({'warlock': 0, 'titan': 1, 'hunter': 2})[vm.active];

        $scope.$broadcast('dim-edit-loadout', {
          loadout: loadout,
          equipAll: true
        });
      },
      getSetBucketsStep: function(activeGaurdian) {
        var bestArmor = getBestArmor(buckets[activeGaurdian], vm.lockeditems),
            helms = bestArmor['Helmet'] || [],
            gaunts = bestArmor['Gauntlets'] || [],
            chests = bestArmor['Chest'] || [],
            legs = bestArmor['Leg'] || [],
            classItems = bestArmor['ClassItem'] || [],
            ghosts = bestArmor['Ghost'] || [],
            artifacts = bestArmor['Artifact'] || [];

        if(helms.length === 0 || gaunts.length === 0 || chests.length === 0 ||
           legs.length === 0 || classItems.length === 0 || ghosts.length === 0 || artifacts.length === 0) {
          return null;
        }

        var set_map = {},
            int, dis, str, set,
            combos = (helms.length * gaunts.length * chests.length * legs.length * classItems.length * ghosts.length * artifacts.length) || 1;

        function step(activeGaurdian, h, g, c, l, ci, gh, ar, processed_count) {
          for(; h < helms.length; ++h) {
            for(; g < gaunts.length; ++g) {
              for(; c < chests.length; ++c) {
                for(; l < legs.length; ++l) {
                  for(; ci < classItems.length; ++ci) {
                    for(; gh < ghosts.length; ++gh) {
                      for(; ar < artifacts.length; ++ar) {
                        set = {
                          armor: {
                            Helmet: helms[h],
                            Gauntlets: gaunts[g],
                            Chest: chests[c],
                            Leg: legs[l],
                            ClassItem: classItems[ci],
                            Artifact: artifacts[ar],
                            Ghost: ghosts[gh]
                          },
                          stats: {
                            STAT_INTELLECT: {
                              value: 0,
                              name: 'Intellect'
                            },
                            STAT_DISCIPLINE: {
                              value: 0,
                              name: 'Discipline'
                            },
                            STAT_STRENGTH: {
                              value: 0,
                              name: 'Strength'
                            }
                          },
                          int_val: 0,
                          disc_val: 0,
                          str_val: 0
                        };
                        if(validSet(set.armor)) {
                          _.each(set.armor, function(armor) {
                            int = armor.item.normalStats[144602215];
                            dis = armor.item.normalStats[1735777505];
                            str = armor.item.normalStats[4244567218];

                            set.stats.STAT_INTELLECT.value += int[vm.scale_type];
                            set.stats.STAT_DISCIPLINE.value += dis[vm.scale_type];
                            set.stats.STAT_STRENGTH.value += str[vm.scale_type];

                            switch(armor.bonus_type) {
                              case 'int': set.stats.STAT_INTELLECT.value += int.bonus; break;
                              case 'disc': set.stats.STAT_DISCIPLINE.value += dis.bonus; break;
                              case 'str': set.stats.STAT_STRENGTH.value += str.bonus; break;
                            }
                          });

                          var tiers_string = Math.min(Math.floor(set.stats.STAT_INTELLECT.value/60), 5) +
                              '/' + Math.min(Math.floor(set.stats.STAT_DISCIPLINE.value/60), 5) +
                              '/' + Math.min(Math.floor(set.stats.STAT_STRENGTH.value/60), 5);
                          if(set_map[tiers_string]) {
                            set_map[tiers_string].push(set);
                          } else {
                            set_map[tiers_string] = [set];
                          }
                        }

                        processed_count++;
//                        if(vm.mode) {
                          if(processed_count % 50000 === 0) {
                            // If active gaurdian or page is changed then stop processing combinations
                            if(vm.active !== activeGaurdian ||  vm.lockedchanged || $location.path() !== '/best') {
                              vm.lockedchanged = false;
                              return;
                            }
                            vm.progress = processed_count/combos;
                            $timeout(step, 0, true, activeGaurdian, h,g,c,l,ci,gh,ar,processed_count);
                            return;
                          }
//                        }
                      } ar = 0; } gh = 0; } ci = 0; } l = 0; } c = 0; } g = 0; }

          var tiers = _.each(_.groupBy(Object.keys(set_map), function(set) {
            return _.reduce(set.split('/'), function(memo, num){
              return memo + parseInt(num, 10);
            }, 0);
          }), function(tier) {
            tier.sort().reverse();
          });

          vm.allSetTiers = [];
          var tier_keys = Object.keys(tiers);
          for (var t = tier_keys.length; t-- > tier_keys.length - 3; ) {
            vm.allSetTiers.push('- Tier ' + tier_keys[t] + ' -');
            _.each(tiers[tier_keys[t]], function(set) {
              vm.allSetTiers.push(set);
            });
          }

          vm.activesets = vm.allSetTiers[1];

          // Finish progress
          vm.progress = processed_count/combos;
          console.log('processed', combos, 'combinations.');
          console.timeEnd('elapsed');
        }
        console.time('elapsed');
        vm.lockedchanged = false;
          $timeout(step, 0, true, activeGaurdian, 0,0,0,0,0,0,0,0);
        return set_map;
      },
      getBonus: dimStoreService.getBonus,
      getStore: dimStoreService.getStore,
      // get Items for infusion
      getItems: function() {
        var stores = dimStoreService.getStores();

        if(stores.length === 0) {
          $state.go('inventory');
          return;
        }

        var allItems = [];
        vm.active = _.sortBy(stores, 'lastPlayed').reverse()[0].class.toLowerCase() || 'warlock';

        // all stores
        _.each(stores, function(store, id) {

          // all armor in store
          var items = _.filter(store.items, function(item) {
            return item.primStat &&
              item.primStat.statHash === 3897883278 && // has defence hash
              ((vm.showBlues && item.tier === 'Rare') || item.tier === 'Legendary' || (vm.showExotics && item.isExotic)) &&
              item.primStat.value >= 280 && // only 280+ light items
              item.stats;
          });

          allItems = allItems.concat(items);
        });

        buckets = initBuckets(allItems);

        vm.onCharacterChange();
      }
    });

    vm.getItems();
  }
})();
