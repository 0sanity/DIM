import { IScope } from 'angular';
import {
  DestinyCharacterComponent,
  DestinyFactionProgression,
  DestinyItemComponent,
  DestinyMilestone,
  DestinyObjectiveProgress,
  DestinyVendorComponent
} from 'bungie-api-ts/destiny2';
import { t } from 'i18next';
import * as React from 'react';
import { Frame, Track, View, ViewPager } from 'react-view-pager';
import * as _ from 'lodash';
import { DestinyAccount } from '../accounts/destiny-account.service';
import CharacterTile, { characterIsCurrent } from './CharacterTile';
import { Faction } from './Faction';
import { Milestone } from './Milestone';
import './progress.scss';
import { ProgressProfile, reloadProgress, getProgressStream } from './progress.service';
import Quest from './Quest';
import WellRestedPerkIcon from './WellRestedPerkIcon';
import { CrucibleRank } from './CrucibleRank';
import ErrorBoundary from '../dim-ui/ErrorBoundary';
import { Loading } from '../dim-ui/Loading';
import { connect } from 'react-redux';
import { RootState } from '../store/reducers';
import { chainComparator, compareBy } from '../comparators';
import { characterComponentSortSelector } from '../settings/character-sort';
import { Subscriptions } from '../rx-utils';
import { refresh$ } from '../shell/refresh';

const factionOrder = [
  611314723, // Vanguard,
  3231773039, // Vanguard Research,
  697030790, // Crucible,
  1021210278, // Gunsmith,

  4235119312, // EDZ Deadzone Scout,
  4196149087, // Titan Field Commander,
  1660497607, // Nessus AI,
  828982195, // Io Researcher,
  3859807381, // Voice of Rasputin,
  2677528157, // Follower of Osiris,
  24856709, // Leviathan,

  469305170, // The Nine,
  1761642340, // Iron Banner,

  2105209711, // New Monarchy,
  1714509342, // Future War Cult,
  3398051042 // Dead Orbit
];

interface Props {
  $scope: IScope;
  account: DestinyAccount;
  isPhonePortrait: boolean;
  characterOrder(characters: DestinyCharacterComponent[]): DestinyCharacterComponent[];
}

interface State {
  progress?: ProgressProfile;
  currentCharacterId: string;
}

function mapStateToProps(state: RootState): Partial<Props> {
  return {
    isPhonePortrait: state.shell.isPhonePortrait,
    characterOrder: characterComponentSortSelector(state)
  };
}

class Progress extends React.Component<Props, State> {
  private subscriptions = new Subscriptions();

  constructor(props) {
    super(props);
    this.state = {
      currentCharacterId: ''
    };
  }

  componentDidMount() {
    this.subscriptions.add(
      refresh$.subscribe(reloadProgress),
      getProgressStream(this.props.account).subscribe((progress) => {
        this.setState((prevState) => {
          const updatedState = {
            progress,
            currentCharacterId: prevState.currentCharacterId
          };
          if (prevState.currentCharacterId === '') {
            const characters = Object.values(progress.profileInfo.characters.data);
            if (characters.length) {
              const lastPlayedDate = progress.lastPlayedDate;
              updatedState.currentCharacterId = characters.find((c) =>
                characterIsCurrent(c, lastPlayedDate)
              )!.characterId;
            }
          }

          return updatedState;
        });
      })
    );
  }

  componentWillUnmount() {
    this.subscriptions.unsubscribe();
  }

  render() {
    if (!this.state.progress) {
      return (
        <div className="progress-page dim-page">
          <Loading />
        </div>
      );
    }

    const { defs, profileInfo } = this.state.progress;

    const characters = this.props.characterOrder(Object.values(profileInfo.characters.data));

    const profileMilestones = this.milestonesForProfile(characters[0]);
    const profileQuests = this.questItems(profileInfo.profileInventory.data.items);

    const firstCharacterProgression = Object.values(profileInfo.characterProgressions.data)[0]
      .progressions;
    const crucibleRanks = [
      // Valor
      firstCharacterProgression[3882308435],
      // Glory
      firstCharacterProgression[2679551909],
      // Infamy
      firstCharacterProgression[2772425241]
    ];

    const profileMilestonesContent = (profileMilestones.length > 0 || profileQuests.length > 0) && (
      <>
        <div className="profile-content">
          {profileMilestones.length > 0 && (
            <div className="section">
              <div className="title">{t('Progress.ProfileMilestones')}</div>
              <div className="progress-row">
                <div className="progress-for-character">
                  <ErrorBoundary name="AccountMilestones">
                    {profileMilestones.map((milestone) => (
                      <Milestone
                        milestone={milestone}
                        character={characters[0]}
                        defs={defs}
                        key={milestone.milestoneHash}
                      />
                    ))}
                  </ErrorBoundary>
                </div>
              </div>
            </div>
          )}

          {profileQuests.length > 0 && (
            <div className="section">
              <div className="title">{t('Progress.ProfileQuests')}</div>
              <div className="progress-row">
                <div className="progress-for-character">
                  <ErrorBoundary name="AccountQuests">
                    {profileQuests.map((item) => (
                      <Quest
                        defs={defs}
                        item={item}
                        objectives={this.objectivesForItem(characters[0], item)}
                        key={item.itemInstanceId ? item.itemInstanceId : item.itemHash}
                      />
                    ))}
                  </ErrorBoundary>
                </div>
              </div>
            </div>
          )}

          <div className="section crucible-ranks">
            <div className="title">{t('Progress.CrucibleRank')}</div>
            <div className="progress-row">
              <div className="progress-for-character">
                <ErrorBoundary name="CrucibleRanks">
                  {crucibleRanks.map(
                    (progression) =>
                      progression && (
                        <CrucibleRank
                          key={progression.progressionHash}
                          defs={defs}
                          progress={progression}
                        />
                      )
                  )}
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </div>
        <hr />
      </>
    );

    if (this.props.isPhonePortrait) {
      return (
        <div className="progress-page dim-page">
          {profileMilestonesContent}
          <ViewPager>
            <Frame className="frame" autoSize={true}>
              <Track
                currentView={this.state.currentCharacterId}
                viewsToShow={1}
                contain={true}
                className="track"
                flickTimeout={100}
              >
                {characters.map((character) => (
                  <View className="view" key={character.characterId}>
                    {this.renderCharacters([character])}
                  </View>
                ))}
              </Track>
            </Frame>
          </ViewPager>
        </div>
      );
    } else {
      return (
        <div className="progress-page dim-page">
          {profileMilestonesContent}
          {this.renderCharacters(characters)}
        </div>
      );
    }
  }

  /**
   * Render one or more characters. This could render them all, or just one at a time.
   */
  private renderCharacters(characters: DestinyCharacterComponent[]) {
    const { defs, profileInfo, lastPlayedDate } = this.state.progress!;

    const pursuitsLabel = defs.InventoryBucket[1345459588].displayProperties.name;

    return (
      <>
        <div className="progress-characters">
          {characters.map((character) => (
            <CharacterTile
              key={character.characterId}
              character={character}
              defs={defs}
              lastPlayedDate={lastPlayedDate}
            />
          ))}
        </div>

        <div className="section">
          <div className="title">{t('Progress.Milestones')}</div>
          <div className="progress-row">
            <ErrorBoundary name="Milestones">
              {characters.map((character) => (
                <div className="progress-for-character" key={character.characterId}>
                  <WellRestedPerkIcon
                    defs={defs}
                    progressions={profileInfo.characterProgressions.data[character.characterId]}
                  />
                  {this.milestonesForCharacter(character).map((milestone) => (
                    <Milestone
                      milestone={milestone}
                      character={character}
                      defs={defs}
                      key={milestone.milestoneHash}
                    />
                  ))}
                </div>
              ))}
            </ErrorBoundary>
          </div>
        </div>

        <div className="section">
          <div className="title">{pursuitsLabel}</div>
          <div className="progress-row">
            <ErrorBoundary name="Quests">
              {characters.map((character) => (
                <div className="progress-for-character" key={character.characterId}>
                  {this.questItems(
                    profileInfo.characterInventories.data[character.characterId].items
                  ).map((item) => (
                    <Quest
                      defs={defs}
                      item={item}
                      objectives={this.objectivesForItem(character, item)}
                      key={item.itemInstanceId ? item.itemInstanceId : item.itemHash}
                    />
                  ))}
                </div>
              ))}
            </ErrorBoundary>
          </div>
        </div>

        <div className="section">
          <div className="title">{t('Progress.Factions')}</div>
          <div className="progress-row">
            <ErrorBoundary name="Factions">
              {characters.map((character) => (
                <div className="progress-for-character" key={character.characterId}>
                  {this.factionsForCharacter(character).map((faction) => (
                    <Faction
                      factionProgress={faction}
                      defs={defs}
                      character={character}
                      profileInventory={profileInfo.profileInventory.data}
                      key={faction.factionHash}
                      vendor={this.vendorForFaction(character, faction)}
                    />
                  ))}
                </div>
              ))}
            </ErrorBoundary>
          </div>
        </div>
      </>
    );
  }

  private vendorForFaction(
    character: DestinyCharacterComponent,
    faction: DestinyFactionProgression
  ): DestinyVendorComponent | undefined {
    if (faction.factionVendorIndex < 0) {
      return undefined;
    }

    const { vendors, defs } = this.state.progress!;
    const factionDef = defs.Faction[faction.factionHash];
    const vendorHash = factionDef.vendors[faction.factionVendorIndex].vendorHash;
    return vendors[character.characterId]
      ? vendors[character.characterId].vendors.data[vendorHash]
      : undefined;
  }

  /**
   * Get all the milestones that are valid across the whole profile. This still requires a character (any character)
   * to look them up, and the assumptions underlying this may get invalidated as the game evolves.
   */
  private milestonesForProfile(character: DestinyCharacterComponent): DestinyMilestone[] {
    const { defs, profileInfo } = this.state.progress!;

    const allMilestones: DestinyMilestone[] = Object.values(
      profileInfo.characterProgressions.data[character.characterId].milestones
    );

    const filteredMilestones = allMilestones.filter((milestone) => {
      return (
        !milestone.availableQuests &&
        !milestone.activities &&
        (milestone.vendors || milestone.rewards) &&
        defs.Milestone.get(milestone.milestoneHash)
      );
    });

    return _.sortBy(filteredMilestones, (milestone) => milestone.order);
  }

  /**
   * Get all the milestones to show for a particular character, filtered to active milestones and sorted.
   */
  private milestonesForCharacter(character: DestinyCharacterComponent): DestinyMilestone[] {
    const { profileInfo, defs } = this.state.progress!;

    const allMilestones: DestinyMilestone[] =
      profileInfo.characterProgressions &&
      profileInfo.characterProgressions.data &&
      profileInfo.characterProgressions.data[character.characterId]
        ? Object.values(profileInfo.characterProgressions.data[character.characterId].milestones)
        : [];

    const filteredMilestones = allMilestones.filter((milestone) => {
      const def = defs.Milestone.get(milestone.milestoneHash);
      return (
        (def.showInExplorer || def.showInMilestones) &&
        (milestone.activities ||
          (milestone.availableQuests &&
            milestone.availableQuests.every(
              (q) =>
                q.status.stepObjectives.length > 0 &&
                q.status.started &&
                (!q.status.completed || !q.status.redeemed)
            )))
      );
    });

    return _.sortBy(filteredMilestones, (milestone) => milestone.order);
  }

  /**
   * Get all the factions to show for a particular character.
   */
  private factionsForCharacter(character: DestinyCharacterComponent): DestinyFactionProgression[] {
    const { profileInfo } = this.state.progress!;

    const allFactions: DestinyFactionProgression[] = Object.values(
      profileInfo.characterProgressions.data[character.characterId].factions
    );
    return _.sortBy(allFactions, (f) => {
      const order = factionOrder.indexOf(f.factionHash);
      return (order >= 0 ? order : 999) + (f.factionVendorIndex === -1 ? 1000 : 0);
    });
  }

  /**
   * Get all items in this character's inventory that represent quests - some are actual items that take
   * up inventory space, others are in the "Progress" bucket and need to be separated from the quest items
   * that represent milestones.
   */
  private questItems(allItems: DestinyItemComponent[]): DestinyItemComponent[] {
    const { defs } = this.state.progress!;

    const filteredItems = allItems.filter((item) => {
      const itemDef = defs.InventoryItem.get(item.itemHash);

      if (!itemDef || itemDef.redacted) {
        return false;
      }

      // Pursuits
      if (itemDef.inventory && itemDef.inventory.bucketTypeHash === 1345459588) {
        return true;
      }

      // Also include prophecy tablets
      return itemDef.itemCategoryHashes && itemDef.itemCategoryHashes.includes(2250046497);
    });

    filteredItems.sort(
      chainComparator(
        compareBy((item) => {
          return item.expirationDate ? new Date(item.expirationDate) : new Date(8640000000000000);
        }),
        compareBy((item) => {
          const itemDef = defs.InventoryItem.get(item.itemHash);
          return itemDef.itemType;
        }),
        compareBy((item) => {
          // Sort by icon image, but only for bounties...
          const itemDef = defs.InventoryItem.get(item.itemHash);
          if (itemDef.itemCategoryHashes && itemDef.itemCategoryHashes.includes(1784235469)) {
            return itemDef.displayProperties.icon;
          } else {
            return undefined;
          }
        }),
        compareBy((item) => {
          const itemDef = defs.InventoryItem.get(item.itemHash);
          return itemDef.displayProperties.name;
        })
      )
    );
    return filteredItems;
  }

  /**
   * Get the list of objectives associated with a specific quest item. Sometimes these have their own objectives,
   * and sometimes they are disassociated and stored in characterProgressions.
   */
  private objectivesForItem(
    character: DestinyCharacterComponent,
    item: DestinyItemComponent
  ): DestinyObjectiveProgress[] {
    const { profileInfo } = this.state.progress!;

    const objectives = item.itemInstanceId
      ? profileInfo.itemComponents.objectives.data[item.itemInstanceId]
      : undefined;
    if (objectives) {
      return objectives.objectives;
    }
    return (
      profileInfo.characterProgressions.data[character.characterId].uninstancedItemObjectives[
        item.itemHash
      ] || []
    );
  }
}

export default connect(mapStateToProps)(Progress);
