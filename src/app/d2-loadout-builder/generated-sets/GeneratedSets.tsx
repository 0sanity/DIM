import { t } from 'i18next';
import * as React from 'react';
import * as _ from 'underscore';
import { Loadout } from '../../loadout/loadout.service';
import { ArmorSet, LockType } from '../types';
import { getSetsForTier, getSetTiers } from './utils';
import GeneratedSetButtons from './GeneratedSetButtons';
import { DimStore } from '../../inventory/store-types';
import LoadoutDrawer from '../../loadout/LoadoutDrawer';
import { $rootScope } from 'ngimport';
import GeneratedSetItem from './GeneratedSetItem';

interface Props {
  processRunning: number;
  selectedStore?: DimStore;
  processedSets: ArmorSet[];
  lockedMap: { [bucketHash: number]: LockType };
}

interface State {
  minimumPower: number;
  selectedTier: string;
}

let matchedSets: ArmorSet[] = [];

/**
 * Renders the generated sets (processedSets)
 */
export default class GeneratedSets extends React.Component<Props, State> {
  state: State = {
    selectedTier: '7/7/7',
    minimumPower: 0
  };

  // Set the loadout property to show/hide the loadout menu
  setCreateLoadout = (loadout?: Loadout) => {
    $rootScope.$broadcast('dim-edit-loadout', {
      loadout,
      showClass: false
    });
  };

  componentWillReceiveProps(props: Props) {
    if (props.processedSets !== this.props.processedSets) {
      this.setState({ minimumPower: 0 });
    }
  }

  render() {
    const { processRunning, lockedMap, selectedStore } = this.props;
    const { selectedTier, minimumPower } = this.state;

    if (processRunning > 0) {
      return <h3>{t('LoadoutBuilder.Loading', { loading: processRunning })}</h3>;
    }

    // Filter before set tiers are generated
    const uniquePowerLevels = new Set<number>();
    matchedSets = this.props.processedSets.filter((set) => {
      uniquePowerLevels.add(Math.floor(set.power / 5));
      return set.power / 5 > minimumPower;
    });
    const powerLevelOptions = Array.from(uniquePowerLevels).sort((a, b) => a - b);
    powerLevelOptions.splice(0, 0, 0);

    // build tier dropdown options
    const setTiers = getSetTiers(matchedSets);
    let currentTier = selectedTier;
    if (!setTiers.includes(currentTier)) {
      currentTier = setTiers[1];
    }

    // Only render sets for the selected tier
    matchedSets = getSetsForTier(matchedSets, lockedMap, currentTier);

    if (matchedSets.length === 0) {
      return <h3>{t('LoadoutBuilder.NoBuildsFound')}</h3>;
    }

    return (
      <>
        <h3>{t('LoadoutBuilder.SelectPower')}</h3>
        <select
          value={minimumPower}
          onChange={(element) => {
            this.setState({ minimumPower: parseInt(element.target.value, 10) });
          }}
        >
          {powerLevelOptions.map((power) => {
            if (power === 0) {
              return (
                <option value={0} key={power}>
                  {t('LoadoutBuilder.SelectPowerMinimum')}
                </option>
              );
            }
            return <option key={power}>{power}</option>;
          })}
        </select>

        <h3>{t('LoadoutBuilder.SelectTier')}</h3>
        <select
          value={currentTier}
          onChange={(element) => {
            this.setState({ selectedTier: element.target.value });
          }}
        >
          {setTiers.map((tier) => (
            <option key={tier} disabled={tier.charAt(0) === '-'}>
              {tier}
            </option>
          ))}
        </select>

        <h3>{t('LoadoutBuilder.GeneratedBuilds')}</h3>
        {matchedSets.map((set, index) => (
          <div className="generated-build" key={index}>
            <GeneratedSetButtons
              set={set}
              store={selectedStore!}
              onLoadoutSet={this.setCreateLoadout}
            />
            <div className="sub-bucket">
              {Object.values(set.armor).map((item) => (
                <GeneratedSetItem key={item.index} item={item} />
              ))}
            </div>
          </div>
        ))}
        <LoadoutDrawer />
      </>
    );
  }
}
