import * as React from 'react';
import * as _ from 'underscore';
import { ProgressService, ProgressProfile } from './progress.service';
import { IScope } from 'angular';
import { DestinyAccount } from '../accounts/destiny-account.service';
import { Subscription } from '@reactivex/rxjs';
import { CharacterTile } from './character-tile';
import { Milestone } from './milestone';
import { Faction } from './faction';
import { Quest } from './quest';
import { IDestinyCharacterComponent, IDestinyMilestone, IDestinyFactionProgression, IDestinyItemComponent, IDestinyObjectiveProgress } from '../bungie-api/interfaces';
import { t } from 'i18next';
import { ViewPager, Frame, Track, View } from 'react-view-pager';
import { isPhonePortraitStream, isPhonePortrait } from '../mediaQueries';
import './progress.scss';

/* Label isn't used, but it helps us understand what each one is */
const progressionMeta = {
  611314723: { label: "Vanguard", order: 1 },
  3231773039: { label: "Vanguard Research", order: 2 },
  697030790: { label: "Crucible", order: 3 },
  1021210278: { label: "Gunsmith", order: 4 },

  4235119312: { label: "EDZ Deadzone Scout", order: 5 },
  4196149087: { label: "Titan Field Commander", order: 6 },
  1660497607: { label: "Nessus AI", order: 7 },
  828982195: { label: "Io Researcher", order: 8 },
  2677528157: { label: "Follower of Osiris", order: 9 },

  2105209711: { label: "New Monarchy", order: 10 },
  1714509342: { label: "Future War Cult", order: 11 },
  3398051042: { label: "Dead Orbit", order: 12 },
  3468066401: { label: "The Nine", order: 13 },
  1761642340: { label: "Iron Banner", order: 14 },

  1482334108: { label: "Leviathan", order: 15 }
};

interface Props {
  ProgressService: ProgressService;
  $scope: IScope;
  account: DestinyAccount;
  dimSettingsService;
}

type CharacterOrder = 'mostRecent' | 'mostRecentReverse' | 'fixed';

interface State {
  progress?: ProgressProfile;
  characterOrder: CharacterOrder;
  isPhonePortrait: boolean;
}

export class Progress extends React.Component<Props, State> {
  subscription: Subscription;
  mediaQuerySubscription: Subscription;

  constructor(props: Props) {
    super(props);
    this.state = {
      characterOrder: this.props.dimSettingsService.characterOrder,
      isPhonePortrait: isPhonePortrait()
    };
  }

  componentDidMount() {
    this.subscription = this.props.ProgressService.getProgressStream(this.props.account).subscribe((progress) => {
      this.setState({ progress });
    });

    this.mediaQuerySubscription = isPhonePortraitStream().subscribe((phonePortrait: boolean) => {
      if (phonePortrait !== this.state.isPhonePortrait) {
        this.setState({ isPhonePortrait: phonePortrait });
      }
    });

    this.props.$scope.$on('dim-refresh', () => {
      this.props.ProgressService.reloadProgress();
    });

    this.props.$scope.$watch(() => this.props.dimSettingsService.characterOrder, (newValue: CharacterOrder) => {
      if (newValue !== this.state.characterOrder) {
        this.setState({ characterOrder: newValue });
      }
    });
  }

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  render() {
    if (!this.state.progress) {
      return <div className="progress dim-page">Loading...</div>;
    }

    const { defs, profileInfo } = this.state.progress;

    const characters = sortCharacters(Object.values(profileInfo.characters.data), this.state.characterOrder);

    const profileMilestones = this.milestonesForProfile(characters[0]);
    const profileMilestonesContent = profileMilestones.length &&
      (
        <div className="section">
          <div className="title">{t('Progress.ProfileMilestones')}</div>
          <div className="progress-row">
            <div className="progress-for-character">
              {profileMilestones.map((milestone) =>
                <Milestone milestone={milestone} defs={defs} key={milestone.milestoneHash} />
              )}
            </div>
          </div>
          <hr/>
        </div>
      );

    if (this.state.isPhonePortrait) {
      return (
        <div className="progress dim-page">
          {profileMilestonesContent}
          <ViewPager>
            <Frame className="frame">
              <Track
                viewsToShow={1}
                contain={true}
                className="track"
                autoSize={true}
              >
                {characters.map((character) =>
                  <View className="view" key={character.characterId}>{this.renderCharacters([character])}</View>
                )}
              </Track>
            </Frame>
          </ViewPager>
        </div>
      );
    } else {
      return (
        <div className="progress dim-page">
          {profileMilestonesContent}
          {this.renderCharacters(characters)}
        </div>
      );
    }
  }

  /**
   * Render one or more characters. This could render them all, or just one at a time.
   */
  private renderCharacters(characters) {
    const { defs, profileInfo, lastPlayedDate } = this.state.progress!;

    function ProgressSection(props) {
      const { children, title } = props;

      if (children.length) {
        return (
          <div className="section">
            <div className="title">{title}</div>
            <div className="progress-row">
              <div className="progress-for-character">
                {children}
              </div>
            </div>
          </div>
        );
      }
    }

    return (
      <>
        <div className="progress-characters">
          {characters.map((character) =>
            <CharacterTile
              key={character.characterId}
              character={character}
              defs={defs}
              lastPlayedDate={lastPlayedDate}
            />
          )}
        </div>

        <div className="section">
          <div className="title">{t('Progress.Milestones')}</div>
          <div className="progress-row">
            {characters.map((character) =>
              <div className="progress-for-character" key={character.characterId}>
                {this.milestonesForCharacter(character).map((milestone) =>
                  <Milestone milestone={milestone} defs={defs} key={milestone.milestoneHash} />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="section">
          <div className="title">{t('Progress.Quests')}</div>
          <div className="progress-row">
            {characters.map((character) =>
              <div className="progress-for-character" key={character.characterId}>
                {this.questItemsForCharacter(character).map((item) =>
                  <Quest defs={defs} item={item} objectives={this.objectivesForItem(character, item)} key={item.itemInstanceId ? item.itemInstanceId : item.itemHash}/>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="section">
          <div className="title">{t('Progress.Factions')}</div>
          <div className="progress-row">
            {characters.map((character) =>
              <div className="progress-for-character" key={character.characterId}>
                {this.factionsForCharacter(character).map((faction) =>
                  <Faction factionProgress={faction} defs={defs} profileInventory={profileInfo.profileInventory.data} key={faction.factionHash} />
                )}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  /**
   * Get all the milestones that are valid across the whole profile. This still requires a character (any character)
   * to look them up, and the assumptions underlying this may get invalidated as the game evolves.
   */
  private milestonesForProfile(character: IDestinyCharacterComponent): IDestinyMilestone[] {
    const { defs, profileInfo } = this.state.progress!;

    const allMilestones: IDestinyMilestone[] = Object.values(profileInfo.characterProgressions.data[character.characterId].milestones);

    const filteredMilestones = allMilestones.filter((milestone) => {
      return !milestone.availableQuests && (milestone.vendors || milestone.rewards);
    });

    // Sort them alphabetically by name
    return _.sortBy(filteredMilestones, (milestone) => {
      const milestoneDef = defs.Milestone.get(milestone.milestoneHash);
      return milestoneDef.displayProperties.name;
    });
  }

  /**
   * Get all the milestones to show for a particular character, filtered to active milestones and sorted.
   */
  private milestonesForCharacter(character: IDestinyCharacterComponent): IDestinyMilestone[] {
    const { defs, profileInfo } = this.state.progress!;

    const allMilestones: IDestinyMilestone[] = Object.values(profileInfo.characterProgressions.data[character.characterId].milestones);

    const filteredMilestones = allMilestones.filter((milestone) => {
      return milestone.availableQuests && milestone.availableQuests.every((q) =>
            q.status.stepObjectives.length > 0 &&
            q.status.started &&
            (!q.status.completed || !q.status.redeemed));
    });

    // Sort them alphabetically by name
    return _.sortBy(filteredMilestones, (milestone) => {
      const milestoneDef = defs.Milestone.get(milestone.milestoneHash);
      if (milestoneDef.displayProperties) {
        return milestoneDef.displayProperties.name;
      } else if (milestone.availableQuests) {
        const questDef = milestoneDef.quests[milestone.availableQuests[0].questItemHash];
        return questDef.displayProperties.name;
      }
    });
  }

  /**
   * Get all the factions to show for a particular character.
   */
  private factionsForCharacter(character: IDestinyCharacterComponent): IDestinyFactionProgression[] {
    const { defs, profileInfo } = this.state.progress!;

    const allFactions: IDestinyFactionProgression[] = Object.values(profileInfo.characterProgressions.data[character.characterId].factions);
    return _.sortBy(allFactions, (f) => progressionMeta[f.factionHash] ? progressionMeta[f.factionHash].order : 999);
  }

  /**
   * Get all items in this character's inventory that represent quests - some are actual items that take
   * up inventory space, others are in the "Progress" bucket and need to be separated from the quest items
   * that represent milestones.
   */
  private questItemsForCharacter(character: IDestinyCharacterComponent): IDestinyItemComponent[] {
    const { defs, profileInfo } = this.state.progress!;

    const allItems: IDestinyItemComponent[] = profileInfo.characterInventories.data[character.characterId].items;
    const filteredItems = allItems.filter((item) => {
      const itemDef = defs.InventoryItem.get(item.itemHash);
      // This required a lot of trial and error.
      return (itemDef.itemCategoryHashes && itemDef.itemCategoryHashes.includes(16)) ||
        (itemDef.inventory && itemDef.inventory.tierTypeHash === 0 &&
          itemDef.backgroundColor && itemDef.backgroundColor.alpha > 0);
    });
    return _.sortBy(filteredItems, (item) => {
      const itemDef = defs.InventoryItem.get(item.itemHash);
      return itemDef.displayProperties.name;
    });
  }

  /**
   * Get the list of objectives associated with a specific quest item. Sometimes these have their own objectives,
   * and sometimes they are disassociated and stored in characterProgressions.
   */
  private objectivesForItem(character: IDestinyCharacterComponent, item: IDestinyItemComponent): IDestinyObjectiveProgress[] {
    const { defs, profileInfo } = this.state.progress!;

    const objectives = profileInfo.itemComponents.objectives.data[item.itemInstanceId];
    if (objectives) {
      return objectives.objectives;
    }
    return profileInfo.characterProgressions.data[character.characterId].uninstancedItemObjectives[item.itemHash] || [];
  }
}

/**
 * Sort a list of characters by a specified sorting method.
 */
export function sortCharacters(characters: IDestinyCharacterComponent[], order: CharacterOrder) {
  if (order === 'mostRecent') {
    return _.sortBy(characters, (store) => {
      return -1 * new Date(store.dateLastPlayed).getTime();
    });
  } else if (order === 'mostRecentReverse') {
    return _.sortBy(characters, (store) => {
      return new Date(store.dateLastPlayed).getTime();
    });
  } else {
    return characters;
  }
}
