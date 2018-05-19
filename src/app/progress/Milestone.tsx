import {
  DestinyMilestone,
  DestinyCharacterComponent
} from 'bungie-api-ts/destiny2';
import * as React from 'react';
import { D2ManifestDefinitions } from '../destiny2/d2-definitions.service';
import BungieImage from '../dim-ui/BungieImage';
import { $state } from '../ngimport-more';
import './milestone.scss';
import RewardActivity from './RewardActivity';
import AvailableQuest from './AvailableQuest';

/**
 * A Milestone is an activity or event that a player can complete to earn rewards.
 * There are several forms of Milestone.
 */
export function Milestone({
  milestone,
  defs,
  character
}: {
  milestone: DestinyMilestone;
  defs: D2ManifestDefinitions;
  character: DestinyCharacterComponent;
}) {
  const milestoneDef = defs.Milestone.get(milestone.milestoneHash);

  if (milestone.availableQuests) {
    // A regular milestone
    return (
      <>
        {milestone.availableQuests.map((availableQuest) =>
          <AvailableQuest
            defs={defs}
            milestoneDef={milestoneDef}
            availableQuest={availableQuest}
            key={availableQuest.questItemHash}
          />
        )}
      </>
    );
  } else if (milestone.vendors) {
    // A vendor milestone (Xur)
    const click = () => $state.go('destiny2.vendor', { id: milestone.vendors[0].vendorHash, characterId: character.characterId });

    return (
      <div className="milestone-quest">
        <div className="milestone-icon">
          <BungieImage src={milestoneDef.displayProperties.icon} />
        </div>
        <div className="milestone-info">
          <span className="milestone-name">{milestoneDef.displayProperties.name}</span>
          <div className="milestone-description">
            {$featureFlags.vendors
              ? <a onClick={click}>{milestoneDef.displayProperties.description}</a>
              : milestoneDef.displayProperties.description
            }
          </div>
        </div>
      </div>
    );
  } else if (milestone.rewards) {
    // Special account-wide milestones (clan)
    const rewards = milestone.rewards[0];
    const milestoneRewardDef = milestoneDef.rewards[rewards.rewardCategoryHash];

    return (
      <div className="milestone-quest">
        <div className="milestone-icon">
          <BungieImage src={milestoneDef.displayProperties.icon} />
        </div>
        <div className="milestone-info">
          <span className="milestone-name">{milestoneDef.displayProperties.name}</span>
          <div className="milestone-description">{milestoneDef.displayProperties.description}</div>
          {rewards.entries.map((rewardEntry) =>
            <RewardActivity key={rewardEntry.rewardEntryHash} rewardEntry={rewardEntry} milestoneRewardDef={milestoneRewardDef} />
          )}
        </div>
      </div>
    );
  }

  return null;
}
