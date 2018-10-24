import * as _ from 'lodash';
import { D2Item } from '../inventory/item-types';
import { LoadoutBuilder } from './LoadoutBuilder';
import { LockableBuckets, ArmorSet, StatTypes } from './types';

let killProcess = false;

/**
 * This safely waits for an existing process to be killed, then begins another.
 */
export default function startNewProcess(
  this: LoadoutBuilder,
  filteredItems: { [bucket: number]: D2Item[] }
) {
  if (this.state.processRunning !== 0) {
    killProcess = true;
    return window.requestAnimationFrame(() => startNewProcess.call(this, filteredItems));
  }

  process.call(this, filteredItems);
}

/**
 * This processes all permutations of armor to build sets
 * TODO: This function must be called such that it has has access to `this.setState`
 *
 * @param filteredItems paired down list of items to process sets from
 */
function process(this: LoadoutBuilder, filteredItems: { [bucket: number]: D2Item[] }) {
  const pstart = performance.now();
  const helms = filteredItems[LockableBuckets.helmet] || [];
  const gaunts = filteredItems[LockableBuckets.gauntlets] || [];
  const chests = filteredItems[LockableBuckets.chest] || [];
  const legs = filteredItems[LockableBuckets.leg] || [];
  const classitems = filteredItems[LockableBuckets.classitem] || [];
  const setMap: ArmorSet[] = [];
  const combos = helms.length * gaunts.length * chests.length * legs.length * classitems.length;

  if (combos === 0) {
    this.setState({ processedSets: [] });
    return;
  }

  function step(h = 0, g = 0, c = 0, l = 0, ci = 0, processedCount = 0) {
    for (; h < helms.length; ++h) {
      for (; g < gaunts.length; ++g) {
        for (; c < chests.length; ++c) {
          for (; l < legs.length; ++l) {
            for (; ci < classitems.length; ++ci) {
              const validSet =
                Number(helms[h].isExotic) +
                  Number(gaunts[g].isExotic) +
                  Number(chests[c].isExotic) +
                  Number(legs[l].isExotic) <
                2;

              if (validSet) {
                const set: ArmorSet = {
                  id: processedCount,
                  armor: [helms[h], gaunts[g], chests[c], legs[l], classitems[ci]],
                  power:
                    helms[h].basePower +
                    gaunts[g].basePower +
                    chests[c].basePower +
                    legs[l].basePower +
                    classitems[ci].basePower,
                  tiers: [],
                  includesVendorItems: false
                };

                const stats: { [statType in StatTypes]: number } = {
                  STAT_MOBILITY: 0,
                  STAT_RESILIENCE: 0,
                  STAT_RECOVERY: 0
                };

                let i = set.armor.length;
                const useBaseStats = this.state.useBaseStats;
                while (i--) {
                  const stat = set.armor[i].stats;
                  if (stat && stat.length) {
                    stats.STAT_MOBILITY += useBaseStats
                      ? stat[0].base // + (stat[0].perkBonus || 0)
                      : stat[0].value || 0;
                    stats.STAT_RESILIENCE += useBaseStats
                      ? stat[1].base // + (stat[1].perkBonus || 0)
                      : stat[1].value || 0;
                    stats.STAT_RECOVERY += useBaseStats
                      ? stat[2].base // + (stat[2].perkBonus || 0)
                      : stat[2].value || 0;
                  }
                }

                // TODO: iterate over perk bonus options and add all tier options
                set.tiers.push(
                  `${stats.STAT_MOBILITY}/${stats.STAT_RESILIENCE}/${stats.STAT_RECOVERY}`
                );

                // set.includesVendorItems = pieces.some((armor: any) => armor.isVendorItem);
                setMap.push(set);
              }

              processedCount++;
              if (processedCount % 50000 === 0) {
                if (killProcess) {
                  this.setState({ processRunning: 0 });
                  killProcess = false;
                  return;
                }
                this.setState({ processRunning: Math.floor((processedCount / combos) * 100) });
                return window.requestAnimationFrame(() => {
                  step.call(this, h, g, c, l, ci, processedCount);
                });
              }
            }
            ci = 0;
          }
          l = 0;
        }
        c = 0;
      }
      g = 0;
    }

    this.setState({
      processedSets: setMap,
      processRunning: 0
    });

    console.log(
      'found',
      Object.keys(setMap).length,
      'sets after processing',
      combos,
      'combinations in',
      performance.now() - pstart
    );
  }

  return step.call(this);
}
