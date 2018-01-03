import * as React from 'react';
import * as _ from 'underscore';
import classNames from 'classnames';
import { t } from 'i18next';
import { IDestinyMilestone, IDestinyMilestoneQuest, IDestinyDisplayPropertiesDefinition, IDestinyObjectiveProgress, IDestinyChallengeStatus, IDestinyMilestoneRewardEntry, IDestinyQuestStatus } from '../bungie-api/interfaces';
import { BungieImage } from '../dim-ui/bungie-image';
import './milestone.scss';

interface MilestoneProps {
  milestone: IDestinyMilestone;
  defs;
}

/**
 * A Milestone is an activity or event that a player can complete to earn rewards.
 * There are several forms of Milestone.
 */
export function Milestone(props: MilestoneProps) {
  const { milestone, defs } = props;

  const milestoneDef = defs.Milestone.get(milestone.milestoneHash);

  if (milestone.availableQuests) {
    return (
      <>
        {milestone.availableQuests.map((availableQuest) =>
          <AvailableQuest
            defs={defs}
            milestone={milestone}
            milestoneDef={milestoneDef}
            availableQuest={availableQuest}
            key={availableQuest.questItemHash}
          />
        )}
      </>
    );
  } else if (milestone.vendors) {
    return (
      <div className="milestone-quest">
        <div className="milestone-icon">
          <BungieImage src={milestoneDef.displayProperties.icon} />
        </div>
        <div className="milestone-info">
          <span className="milestone-name">{milestoneDef.displayProperties.name}</span>
          <div className="milestone-description">{milestoneDef.displayProperties.description}</div>
        </div>
      </div>
    );
  } else if (milestone.rewards) {
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
            <RewardActivity key={rewardEntry.rewardEntryHash} defs={defs} rewardEntry={rewardEntry} milestoneRewardDef={milestoneRewardDef} />
          )}
        </div>
      </div>
    );
  }

  return null;
}

interface RewardActivityProps {
  defs;
  rewardEntry: IDestinyMilestoneRewardEntry;
  milestoneRewardDef;
}

/**
 * For profile-wide milestones with rewards, these show the status of each reward. So
 * far this is only used for the "Clan Objectives" milestone.
 */
function RewardActivity(props: RewardActivityProps) {
  const { defs, rewardEntry, milestoneRewardDef } = props;

  const rewardDef = milestoneRewardDef.rewardEntries[rewardEntry.rewardEntryHash];

  const checkClass = (rewardEntry.redeemed ? 'fa-check-circle' : rewardEntry.earned ? 'fa-check-circle-o' : 'fa-circle-o');
  const tooltip = (rewardEntry.redeemed ? 'Progress.RewardRedeemed' : rewardEntry.earned ? 'Progress.RewardEarned' : 'Progress.RewardNotEarned');

  return (
    <div className={classNames('milestone-reward-activity', { complete: rewardEntry.earned })} title={t(tooltip)}>
      <i className={classNames('fa', checkClass)}/>
      <BungieImage src={rewardDef.displayProperties.icon} />
      <span>{rewardDef.displayProperties.name}</span>
    </div>
  );
}

interface AvailableQuestProps {
  defs;
  milestone: IDestinyMilestone;
  milestoneDef;
  availableQuest: IDestinyMilestoneQuest;
}

/**
 * Most milestones are represented as a quest, with some objectives and a reward associated with them.
 */
function AvailableQuest(props: AvailableQuestProps) {
  const { defs, milestone, milestoneDef, availableQuest } = props;

  const questDef = milestoneDef.quests[availableQuest.questItemHash];
  const displayProperties: IDestinyDisplayPropertiesDefinition = questDef.displayProperties || milestoneDef.displayProperties;

  let activityDef: any = null;
  if (availableQuest.activity) {
    activityDef = defs.Activity.get(availableQuest.activity.activityHash);
  }

  // Only look at the first reward, the rest are screwy (old engram versions, etc)
  const questRewards = questDef.questRewards ? _.take(questDef.questRewards.items, 1).map((r: any) => defs.InventoryItem.get(r.itemHash)) : [];

  const objectives = availableQuest.status.stepObjectives;
  const objective = objectives.length ? objectives[0] : null;
  const objectiveDef = objective ? defs.Objective.get(objective.objectiveHash) : null;

  const tooltip = availableQuest.status.completed ? 'Progress.RewardEarned' : 'Progress.RewardNotEarned';

  return (
    <div className="milestone-quest">
      <div className="milestone-icon" title={t(tooltip)}>
        <BungieImage src={displayProperties.icon} />
        <MilestoneObjectiveStatus objective={objective} status={availableQuest.status} defs={defs} />
      </div>
      <div className="milestone-info">
        <span className="milestone-name">{displayProperties.name}</span>
        {activityDef && activityDef.displayProperties.name !== displayProperties.name &&
          <div className="milestone-location">{activityDef.displayProperties.name}</div>}
        <div className="milestone-description">{objectiveDef ? objectiveDef.progressDescription : displayProperties.description}</div>
        {questRewards.map((questReward) =>
          <div className="milestone-reward" key={questReward.hash}>
            <BungieImage src={questReward.displayProperties.icon} />
            <span>{questReward.displayProperties.name}</span>
          </div>
        )}
        <Challenges defs={defs} availableQuest={availableQuest} />
      </div>
    </div>
  );
}

interface ChallengesProps {
  defs;
  availableQuest: IDestinyMilestoneQuest;
}

/**
 * If this quest has associated challenges, display them.
 * There doesn't seem to be any consistency about which quests do and don't have challenges, though.
 */
function Challenges(props: ChallengesProps) {
  const { defs, availableQuest } = props;

  if (!availableQuest.challenges) {
    return null;
  }

  // If we can, filter challenges down to the current activity.
  let filteredChallenges = availableQuest.activity ? availableQuest.challenges.filter((c) => c.objective.activityHash === availableQuest.activity.activityHash) : availableQuest.challenges;

  // Sometimes none of them match the activity, though. I don't know why.
  if (filteredChallenges.length === 0) {
    filteredChallenges = availableQuest.challenges;
  }

  // TODO: If we don't filter, there are duplicates. The duplicates are often for the prestige-mode versions.
  // Not sure if we want to show them since they're dups, but the completion values would be different between
  // them, right?

  // Sometimes a quest can be completed by doing challenges from multiple activities. If that's the case, group
  // them by activity and give each a header to help them make sense.
  const challengesByActivity = _.groupBy(filteredChallenges, (c) => c.objective.activityHash);
  return (
    <>
      {_.map(challengesByActivity, (challengeStatuses, activityHash) => {
        const activityDef = defs.Activity.get(activityHash);

        return (
          <div key={activityHash} className="milestone-challenges">
            {_.size(challengesByActivity) > 1 &&
              <div className="milestone-challenges-activity-name">{activityDef.displayProperties.name}</div>
            }
            {filteredChallenges.map((challenge) =>
              <Challenge key={challenge.objective.objectiveHash} defs={defs} challenge={challenge} />
            )}
          </div>
        );
      })}
    </>
  );
}

interface ChallengeProps {
  defs;
  challenge: IDestinyChallengeStatus;
}

/**
 * A single challenge. A lot like an objective, but we display it closer to how it appears in-game.
 */
function Challenge(props: ChallengeProps) {
  const { defs, challenge } = props;

  const objectiveDef = defs.Objective.get(challenge.objective.objectiveHash);
  const icon = challenge.objective.complete ? 'fa-check-circle' : 'fa-circle-o';

  return (
    <div
     className={classNames('milestone-challenge', { complete: challenge.objective.complete })}
     title={objectiveDef.displayProperties.description}
    >
    <i className={classNames('fa', icon)}/>
      <div className="milestone-challenge-info">
        <div className="milestone-header">
          <span className="milestone-challenge-name">{objectiveDef.displayProperties.name}</span>
          {objectiveDef.completionValue > 1 &&
            <span className="milestone-challenge-progress">{challenge.objective.progress || 0}/{objectiveDef.completionValue}</span>
          }
        </div>
        <div className="milestone-challenge-description">{objectiveDef.displayProperties.description}</div>
      </div>
    </div>
  );
}

interface MilestoneObjectiveStatusProps {
  objective: IDestinyObjectiveProgress | null;
  status: IDestinyQuestStatus;
  defs: any;
}

/**
 * The display for a milestone quest's objective. Either a count to be shown under the icon, or a
 * checkmark if the objective has been completed but not picked up. If it's a single-step objective
 * don't display anything until it's complete, because it's obvious there's only one thing to do.
 */
function MilestoneObjectiveStatus(props: MilestoneObjectiveStatusProps) {
  const { objective, defs, status } = props;
  if (objective) {
    const objectiveDef = defs.Objective.get(objective.objectiveHash);

    let progress = objective.progress || 0;
    let completionValue = objectiveDef.completionValue;
    if (objective.objectiveHash === 3289403948) {
      progress *= 250;
      completionValue *= 250;
    }

    if (status.completed) {
      return <span><i className="fa fa-check-circle-o"/></span>;
    } else if (completionValue > 1) {
      return <span>{progress}/{completionValue}</span>;
    }
  }

  return null;
}
