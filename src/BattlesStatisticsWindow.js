import React from 'react';
import { Link } from 'react-router-dom';
import { injectIntl, FormattedMessage } from 'react-intl';
import queryString from 'query-string';
import { PageHeader, Alert, Button, Row, Col, Card, Statistic } from 'antd';
import { Chart, Geom, Axis, Tooltip } from 'bizcharts';

import './BattlesStatisticsWindow.css';
import icon from './assets/images/mode-regular.png';
import ErrorResult from './components/ErrorResult';
import LoadingResult from './components/LoadingResult';
import StatisticsCard from './components/StatisticsCard';
import WindowLayout from './components/WindowLayout';
import { RankedBattle, RankedXBattle, LeagueBattle, SplatfestBattle } from './models/Battle';
import { Mode } from './models/Mode';
import { Rank } from './models/Player';
import BattleHelper from './utils/BattleHelper';
import TakosError from './utils/ErrorHelper';
import StorageHelper from './utils/StorageHelper';
import TimeConverter from './utils/TimeConverter';

class BattlesStatisticsWindow extends React.Component {
  state = {
    // Data
    data: [],
    // Render
    loaded: false,
    error: false,
    errorLog: 'unknown_error',
    updateCurrent: 0,
    updateTotal: 0,
    updated: false,
    search: null
  };

  constructor(props) {
    super(props);
    if (this.props.location.search !== '') {
      this.state.search = queryString.parse(this.props.location.search);
    } else {
      this.state.search = null;
    }
  }

  updateBattles = () => {
    // TODO: this method should be extracted
    const getBattleRecursively = (from, to) => {
      return BattleHelper.getBattle(from)
        .then(res => {
          if (res.error !== null) {
            // Handle previous error
            throw new TakosError(res.error);
          } else {
            return StorageHelper.addBattle(res);
          }
        })
        .then(res => {
          if (res instanceof TakosError) {
            throw res;
          } else {
            this.setState({ updateCurrent: this.state.updateCurrent + 1 });
            if (from < to) {
              return getBattleRecursively(from + 1, to);
            }
          }
        })
        .catch(e => {
          if (e instanceof TakosError) {
            return e;
          } else {
            console.error(e);
            return new TakosError('can_not_get_battle');
          }
        });
    };

    this.setState({
      loaded: false,
      error: false,
      updateCurrent: 0,
      updateTotal: 0,
      updated: false
    });
    StorageHelper.latestBattle()
      .then(res => {
        if (res === -1) {
          throw new TakosError('can_not_get_the_latest_battle_from_database');
        } else {
          return res;
        }
      })
      .then(res => {
        const currentNumber = res;
        return BattleHelper.getTheLatestBattleNumber().then(res => {
          if (res === 0) {
            throw new TakosError('can_not_get_battles');
          } else {
            const from = Math.max(1, res - 49, currentNumber + 1);
            const to = res;
            return { from, to };
          }
        });
      })
      .then(res => {
        if (res.to >= res.from) {
          this.setState({ updateCurrent: 1, updateTotal: res.to - res.from + 1 });
        } else {
          return this.getBattles();
        }
        return getBattleRecursively(res.from, res.to).then(res => {
          if (res instanceof TakosError) {
            throw res;
          } else {
            return this.getBattles();
          }
        });
      })
      .then(() => {
        this.setState({ loaded: true });
      })
      .catch(e => {
        this.getBattles()
          .then(() => {
            if (e instanceof TakosError) {
              this.setState({ error: true, errorLog: e.message, updated: true });
            } else {
              console.error(e);
              this.setState({
                error: true,
                errorLog: 'can_not_update_battles',
                updated: true
              });
            }
          })
          .catch();
      })
      .catch(e => {
        console.error(e);
      });
  };

  getBattles = () => {
    return StorageHelper.battles()
      .then(res => {
        this.setState({
          data: res
        });
      })
      .catch(e => {
        console.error(e);
      });
  };

  filteredBattles = () => {
    if (this.state.search === null) {
      return this.state.data;
    } else {
      let data = this.state.data;
      if (this.state.search.with !== undefined) {
        data = data.filter(element => {
          let isWith = false;
          if (
            element.myTeamMembers.find(ele => {
              return ele.id === this.state.search.with;
            }) !== undefined
          ) {
            isWith = true;
          }
          if (
            element.otherTeamMembers.find(ele => {
              return ele.id === this.state.search.with;
            }) !== undefined
          ) {
            isWith = true;
          }
          return isWith;
        });
      }
      return data;
    }
  };

  renderContent = () => {
    return (
      <div>
        {(() => {
          if (this.state.updated) {
            return (
              <Alert
                message={<FormattedMessage id="app.alert.warning" defaultMessage="Warning" />}
                description={
                  <FormattedMessage
                    id="app.alert.warning.battles_can_not_update"
                    defaultMessage="Takos can not update battles, please refresh this page to update."
                  />
                }
                type="warning"
                showIcon
                style={{ marginBottom: '12px' }}
              />
            );
          }
        })()}
        {(() => {
          if (this.state.search !== null) {
            return (
              <Alert
                message={<FormattedMessage id="app.alert.info" defaultMessage="Info" />}
                description={
                  <FormattedMessage
                    id="app.alert.info.battles_filtered"
                    defaultMessage="The battles shown have been filtered, please click <l>here</l> to cancel the screening."
                    values={{
                      l: msg => <Link to="/stats/battles">{msg}</Link>
                    }}
                  />
                }
                type="info"
                showIcon
                style={{ marginBottom: '12px' }}
              />
            );
          }
        })()}
        {(() => {
          const data = this.filteredBattles().sort((a, b) => {
            return b.number - a.number;
          });
          // Battle
          let win = 0;
          let lose = 0;
          let knockOut = 0;
          let knockedOut = 0;
          let elapsedTime = 0;
          let maxElapsedTime = 0;
          let rankedBattleCount = 0;
          let estimatedRankPower = 0;
          let maxEstimatedRankPower = 0;
          let xPowerCount = 0;
          let currentXPower = [];
          let currentMaxXPower = 0;
          let xPower = 0;
          let maxXPower = 0;
          let leagueBattleCount = 0;
          let myEstimatedLeaguePoint = 0;
          let maxMyEstimatedLeaguePoint = 0;
          let otherEstimatedLeaguePoint = 0;
          let maxOtherEstimatedLeaguePoint = 0;
          let leaguePointCount = 0;
          let leaguePoint = 0;
          let maxLeaguePoint = 0;
          let splatfestBattleCount = 0;
          let myEstimatedSplatfestPower = 0;
          let maxMyEstimatedSplatfestPower = 0;
          let otherEstimatedSplatfestPower = 0;
          let maxOtherEstimatedSplatfestPower = 0;
          let splatfestPowerCount = 0;
          let splatfestPower = 0;
          let maxSplatfestPower = 0;
          let contributionPoint = 0;
          let maxContributionPoint = 0;
          let maxTotalContributionPoint = 0;
          // Player
          let selfCurrentRank = [];
          let selfCurrentMaxRank = Rank.cMinus;
          let selfMaxRank = Rank.cMinus;
          let selfPaint = 0;
          let selfMaxPaint = 0;
          let selfKillAndAssist = 0;
          let selfMaxKillAndAssist = 0;
          let selfKill = 0;
          let selfMaxKill = 0;
          let selfAssist = 0;
          let selfMaxAssist = 0;
          let selfDeath = 0;
          let selfMaxDeath = 0;
          let selfSpecial = 0;
          let selfMaxSpecial = 0;
          data.forEach(element => {
            // Battle
            if (element.isWin) {
              win++;
            } else {
              lose++;
            }
            if (element instanceof RankedBattle || element instanceof LeagueBattle) {
              if (element.isKnockOut) {
                knockOut++;
              } else if (element.isKnockedOut) {
                knockedOut++;
              }
            }
            elapsedTime = elapsedTime + element.elapsedTime;
            maxElapsedTime = Math.max(maxElapsedTime, element.elapsedTime);
            if (element instanceof RankedBattle) {
              rankedBattleCount++;
              estimatedRankPower = estimatedRankPower + element.estimatedRankPower;
              maxEstimatedRankPower = Math.max(maxEstimatedRankPower, element.estimatedRankPower);
              if (element instanceof RankedXBattle && !element.isCalculating) {
                currentXPower.push({
                  rule: element.rule,
                  xPower: element.xPowerAfter
                });
              } else {
                currentXPower.push({
                  rule: element.rule,
                  xPower: 0
                });
              }
              if (element instanceof RankedXBattle) {
                if (!element.isCalculating) {
                  xPowerCount++;
                  xPower = xPower + element.xPowerAfter;
                  if (element.xPowerAfter > maxXPower) {
                    maxXPower = element.xPowerAfter;
                  }
                }
              }
            }
            if (element instanceof LeagueBattle) {
              leagueBattleCount++;
              myEstimatedLeaguePoint = myEstimatedLeaguePoint + element.myEstimatedLeaguePoint;
              maxMyEstimatedLeaguePoint = Math.max(maxMyEstimatedLeaguePoint, element.myEstimatedLeaguePoint);
              otherEstimatedLeaguePoint = otherEstimatedLeaguePoint + element.otherEstimatedLeaguePoint;
              maxOtherEstimatedLeaguePoint = Math.max(maxOtherEstimatedLeaguePoint, element.otherEstimatedLeaguePoint);
              if (!element.isCalculating) {
                leaguePointCount++;
                leaguePoint = leaguePoint + parseFloat(element.leaguePoint);
                maxLeaguePoint = Math.max(maxLeaguePoint, parseFloat(element.maxLeaguePoint));
              }
            }
            if (element instanceof SplatfestBattle) {
              splatfestBattleCount++;
              myEstimatedSplatfestPower = myEstimatedSplatfestPower + element.myEstimatedSplatfestPower;
              maxMyEstimatedSplatfestPower = Math.max(maxMyEstimatedSplatfestPower, element.myEstimatedSplatfestPower);
              otherEstimatedSplatfestPower = otherEstimatedSplatfestPower + element.otherEstimatedSplatfestPower;
              maxOtherEstimatedSplatfestPower = Math.max(
                maxOtherEstimatedSplatfestPower,
                element.otherEstimatedSplatfestPower
              );
              if (!element.isCalculating) {
                splatfestPowerCount++;
                splatfestPower = splatfestPower + parseFloat(element.splatfestPower);
                maxSplatfestPower = Math.max(maxSplatfestPower, parseFloat(element.maxSplatfestPower));
              }
              contributionPoint = contributionPoint + element.contributionPoint;
              maxContributionPoint = Math.max(maxContributionPoint, element.contributionPoint);
              maxTotalContributionPoint = Math.max(maxTotalContributionPoint, element.totalContributionPoint);
            }
            // Player
            if (element instanceof RankedBattle) {
              if (
                selfCurrentRank.find(ele => {
                  return ele.rule === element.rule;
                }) === undefined
              ) {
                selfCurrentRank.push({
                  rule: element.rule,
                  rank: element.rankAfter
                });
              }
              if (element.rankAfter.value > selfMaxRank.value) {
                selfMaxRank = element.rankAfter;
              }
              if (element.selfPlayer.rank.value > selfMaxRank.value) {
                selfMaxRank = element.selfPlayer.rank;
              }
            }
            selfPaint = selfPaint + element.selfPlayer.paint;
            selfMaxPaint = Math.max(selfMaxPaint, element.selfPlayer.paint);
            selfKillAndAssist = selfKillAndAssist + element.selfPlayer.killAndAssist;
            selfMaxKillAndAssist = Math.max(selfMaxKillAndAssist, element.selfPlayer.killAndAssist);
            selfKill = selfKill + element.selfPlayer.kill;
            selfMaxKill = Math.max(selfMaxKill, element.selfPlayer.kill);
            selfAssist = selfAssist + element.selfPlayer.assist;
            selfMaxAssist = Math.max(selfMaxAssist, element.selfPlayer.assist);
            selfDeath = selfDeath + element.selfPlayer.death;
            selfMaxDeath = Math.max(selfMaxDeath, element.selfPlayer.death);
            selfSpecial = selfSpecial + element.selfPlayer.special;
            selfMaxSpecial = Math.max(selfMaxSpecial, element.selfPlayer.special);
          });
          selfCurrentRank.forEach(element => {
            if (element.rank.value > selfCurrentMaxRank.value) {
              selfCurrentMaxRank = element.rank;
            }
          });
          currentXPower.forEach(element => {
            if (element.xPower > currentMaxXPower) {
              currentMaxXPower = element.xPower;
            }
          });
          let rankedChartData = [];
          let teamLeaguePowerChartData = [];
          let leaguePowerChartData = [];
          let teamSplatfestPowerChartData = [];
          let splatfestPowerChartData = [];
          data
            .filter(e => {
              return e.gameMode === Mode.rankedBattle;
            })
            .sort((a, b) => {
              return a.number - b.number;
            })
            .slice(-20)
            .forEach(element => {
              if (element instanceof RankedXBattle && !element.isCalculating) {
                rankedChartData.push({
                  number: element.number.toString(),
                  estimatedRankPower: element.estimatedRankPower,
                  xPower: element.xPowerAfter
                });
              } else {
                rankedChartData.push({
                  number: element.number.toString(),
                  estimatedRankPower: element.estimatedRankPower
                });
              }
            });
          data
            .filter(e => {
              return e.gameMode === Mode.leagueBattle;
            })
            .sort((a, b) => {
              return a.number - b.number;
            })
            .slice(-20)
            .forEach(element => {
              if (!element.isCalculating) {
                teamLeaguePowerChartData.push({
                  group: '1',
                  number: element.number.toString(),
                  estimatedLeaguePoint: element.myEstimatedLeaguePoint
                });
                teamLeaguePowerChartData.push({
                  group: '2',
                  number: element.number.toString(),
                  estimatedLeaguePoint: element.otherEstimatedLeaguePoint
                });
                leaguePowerChartData.push({
                  group: '1',
                  number: element.number.toString(),
                  leaguePoint: parseFloat(element.leaguePoint)
                });
                leaguePowerChartData.push({
                  group: '2',
                  number: element.number.toString(),
                  leaguePoint: parseFloat(element.maxLeaguePoint)
                });
              } else {
                teamLeaguePowerChartData.push({
                  group: '1',
                  number: element.number.toString(),
                  estimatedLeaguePoint: element.myEstimatedLeaguePoint
                });
                teamLeaguePowerChartData.push({
                  group: '2',
                  number: element.number.toString(),
                  estimatedLeaguePoint: element.otherEstimatedLeaguePoint
                });
                leaguePowerChartData.push({
                  group: '1',
                  number: element.number.toString()
                });
                leaguePowerChartData.push({
                  group: '2',
                  number: element.number.toString()
                });
              }
            });
          data
            .filter(e => {
              return e.gameMode === Mode.splatfest;
            })
            .sort((a, b) => {
              return a.number - b.number;
            })
            .slice(-20)
            .forEach(element => {
              if (!element.isCalculating) {
                teamSplatfestPowerChartData.push({
                  group: '1',
                  number: element.number.toString(),
                  estimatedSplatfestPower: element.myEstimatedSplatfestPower
                });
                teamSplatfestPowerChartData.push({
                  group: '2',
                  number: element.number.toString(),
                  estimatedSplatfestPower: element.otherEstimatedSplatfestPower
                });
                splatfestPowerChartData.push({
                  group: '1',
                  number: element.number.toString(),
                  splatfestPower: parseFloat(element.splatfestPower)
                });
                splatfestPowerChartData.push({
                  group: '2',
                  number: element.number.toString(),
                  splatfestPower: parseFloat(element.maxSplatfestPower)
                });
              } else {
                teamSplatfestPowerChartData.push({
                  group: '1',
                  number: element.number.toString(),
                  estimatedSplatfestPower: element.myEstimatedSplatfestPower
                });
                teamSplatfestPowerChartData.push({
                  group: '2',
                  number: element.number.toString(),
                  estimatedSplatfestPower: element.otherEstimatedSplatfestPower
                });
                splatfestPowerChartData.push({
                  group: '1',
                  number: element.number.toString()
                });
                splatfestPowerChartData.push({
                  group: '2',
                  number: element.number.toString()
                });
              }
            });
          if (data.length > 0) {
            return (
              <div>
                <PageHeader title={<FormattedMessage id="app.battles" defaultMessage="Battles" />} />
                <Row gutter={16}>
                  <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                    <Card
                      className="BattlesStatisticsWindow-content-card"
                      hoverable
                      title={<FormattedMessage id="app.battles.count" defaultMessage="Battle Times" />}
                      bodyStyle={{ padding: '16px 16px 0 16px', minHeight: '170px' }}
                    >
                      <Row gutter={16}>
                        <Col className="BattlesStatisticsWindow-content-column" span={12}>
                          <Statistic
                            className="BattlesStatisticsWindow-content-statistic"
                            title={<FormattedMessage id="app.splatnet" defaultMessage="SplatNet" />}
                            value={
                              this.state.data.sort((a, b) => {
                                return b.number - a.number;
                              })[0].number
                            }
                          />
                        </Col>
                        <Col className="BattlesStatisticsWindow-content-column" span={12}>
                          <Statistic
                            className="BattlesStatisticsWindow-content-statistic"
                            title={<FormattedMessage id="app.local" defaultMessage="Local" />}
                            value={data.length}
                          />
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                  <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                    <Card
                      className="BattlesStatisticsWindow-content-card"
                      hoverable
                      title={<FormattedMessage id="battle.result" defaultMessage="Result" />}
                      bodyStyle={{ padding: '16px 16px 0 16px', minHeight: '170px' }}
                    >
                      <Row gutter={16}>
                        <Col className="BattlesStatisticsWindow-content-column" span={12}>
                          <Statistic
                            className="BattlesStatisticsWindow-content-statistic"
                            title={<FormattedMessage id="battle.win" defaultMessage="Win!" />}
                            value={win}
                          />
                        </Col>
                        <Col className="BattlesStatisticsWindow-content-column" span={12}>
                          <Statistic
                            className="BattlesStatisticsWindow-content-statistic"
                            title={<FormattedMessage id="battle.knock_out" defaultMessage="Knock Out!" />}
                            value={knockOut}
                          />
                        </Col>
                        <Col className="BattlesStatisticsWindow-content-column" span={12}>
                          <Statistic
                            className="BattlesStatisticsWindow-content-statistic"
                            title={<FormattedMessage id="battle.lose" defaultMessage="Lose.." />}
                            value={lose}
                          />
                        </Col>
                        <Col className="BattlesStatisticsWindow-content-column" span={12}>
                          <Statistic
                            className="BattlesStatisticsWindow-content-statistic"
                            title={<FormattedMessage id="battle.knock_out" defaultMessage="Knock Out!" />}
                            value={knockedOut}
                          />
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                  <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                    <StatisticsCard
                      title={<FormattedMessage id="battle.time.elapsed" defaultMessage="Elapsed Time" />}
                      total={TimeConverter.getBattleElapsedTime(elapsedTime)}
                      average={TimeConverter.getBattleElapsedTime(elapsedTime / data.length)}
                      max={TimeConverter.getBattleElapsedTime(maxElapsedTime)}
                    />
                  </Col>
                </Row>
                {(() => {
                  if (rankedBattleCount > 0) {
                    return (
                      <Row gutter={16}>
                        <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                          <StatisticsCard
                            title={<FormattedMessage id="battle.power" defaultMessage="Power Level" />}
                            average={(estimatedRankPower / rankedBattleCount).toFixed(2)}
                            max={maxEstimatedRankPower}
                          />
                        </Col>
                        {(() => {
                          if (xPowerCount > 0) {
                            return (
                              <Col
                                className="BattlesStatisticsWindow-content-column"
                                xs={24}
                                sm={12}
                                md={12}
                                lg={12}
                                xl={6}
                              >
                                <Card
                                  className="BattlesStatisticsWindow-content-card"
                                  hoverable
                                  title={<FormattedMessage id="battle.power.x" defaultMessage="X Power" />}
                                  bodyStyle={{ padding: '16px 16px 0 16px', minHeight: '170px' }}
                                >
                                  <Row gutter={16}>
                                    <Col className="BattlesStatisticsWindow-content-column" span={24}>
                                      <Statistic
                                        className="BattlesStatisticsWindow-content-statistic"
                                        title={<FormattedMessage id="app.average" defaultMessage="Average" />}
                                        value={(xPower / xPowerCount).toFixed(2)}
                                      />
                                    </Col>
                                    <Col className="BattlesStatisticsWindow-content-column" span={12}>
                                      <Statistic
                                        className="BattlesStatisticsWindow-content-statistic"
                                        title={<FormattedMessage id="app.max.current" defaultMessage="Current Max" />}
                                        value={currentMaxXPower}
                                      />
                                    </Col>
                                    <Col className="BattlesStatisticsWindow-content-column" span={12}>
                                      <Statistic
                                        className="BattlesStatisticsWindow-content-statistic"
                                        title={<FormattedMessage id="app.max.history" defaultMessage="History Max" />}
                                        value={maxXPower}
                                      />
                                    </Col>
                                  </Row>
                                </Card>
                              </Col>
                            );
                          }
                        })()}
                      </Row>
                    );
                  }
                })()}
                {(() => {
                  if (leagueBattleCount > 0) {
                    return (
                      <Row gutter={16}>
                        <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                          <StatisticsCard
                            title={
                              <FormattedMessage id="battle.power.league.my" defaultMessage="My Team League Power" />
                            }
                            average={(myEstimatedLeaguePoint / leagueBattleCount).toFixed(2)}
                            max={maxMyEstimatedLeaguePoint}
                          />
                        </Col>
                        <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                          <StatisticsCard
                            title={
                              <FormattedMessage
                                id="battle.power.league.other"
                                defaultMessage="Other Team League Power"
                              />
                            }
                            average={(otherEstimatedLeaguePoint / leagueBattleCount).toFixed(2)}
                            max={maxOtherEstimatedLeaguePoint}
                          />
                        </Col>
                        {(() => {
                          if (leaguePointCount > 0) {
                            return (
                              <Col
                                className="BattlesStatisticsWindow-content-column"
                                xs={24}
                                sm={12}
                                md={12}
                                lg={12}
                                xl={6}
                              >
                                <StatisticsCard
                                  title={<FormattedMessage id="battle.power.league" defaultMessage="League Power" />}
                                  average={(leaguePoint / leaguePointCount).toFixed(2)}
                                  max={maxLeaguePoint}
                                />
                              </Col>
                            );
                          }
                        })()}
                      </Row>
                    );
                  }
                })()}
                {(() => {
                  if (splatfestBattleCount > 0) {
                    return (
                      <Row gutter={16}>
                        <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                          <StatisticsCard
                            title={
                              <FormattedMessage
                                id="battle.power.splatfest.my"
                                defaultMessage="My Team Splatfest Power"
                              />
                            }
                            average={(myEstimatedSplatfestPower / splatfestBattleCount).toFixed(2)}
                            max={maxMyEstimatedSplatfestPower}
                          />
                        </Col>
                        <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                          <StatisticsCard
                            title={
                              <FormattedMessage
                                id="battle.power.splatfest.other"
                                defaultMessage="Other Team Splatfest Power"
                              />
                            }
                            average={(otherEstimatedSplatfestPower / splatfestBattleCount).toFixed(2)}
                            max={maxOtherEstimatedSplatfestPower}
                          />
                        </Col>
                        {(() => {
                          if (splatfestPowerCount > 0) {
                            return (
                              <Col
                                className="BattlesStatisticsWindow-content-column"
                                xs={24}
                                sm={12}
                                md={12}
                                lg={12}
                                xl={6}
                              >
                                <StatisticsCard
                                  title={
                                    <FormattedMessage id="battle.power.splatfest" defaultMessage="Splatfest Power" />
                                  }
                                  average={(splatfestPower / splatfestPowerCount).toFixed(2)}
                                  max={maxSplatfestPower}
                                />
                              </Col>
                            );
                          }
                        })()}
                        <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                          <StatisticsCard
                            title={<FormattedMessage id="battle.contribution" defaultMessage="Clout" />}
                            total={contributionPoint}
                            average={(contributionPoint / splatfestBattleCount).toFixed(2)}
                            max={maxContributionPoint}
                          />
                        </Col>
                        <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                          <StatisticsCard
                            title={<FormattedMessage id="battle.contribution.total" defaultMessage="Total Clouts" />}
                            max={maxTotalContributionPoint}
                          />
                        </Col>
                      </Row>
                    );
                  }
                })()}
                <PageHeader title={<FormattedMessage id="player" defaultMessage="Player" />} />
                <Row gutter={16}>
                  {(() => {
                    if (rankedBattleCount > 0) {
                      return (
                        <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                          <Card
                            className="BattlesStatisticsWindow-content-card"
                            hoverable
                            title={<FormattedMessage id="rank" defaultMessage="Rank" />}
                            bodyStyle={{ padding: '16px 16px 0 16px', minHeight: '170px' }}
                          >
                            <Row gutter={16}>
                              <Col className="BattlesStatisticsWindow-content-column" span={12}>
                                <Statistic
                                  className="BattlesStatisticsWindow-content-statistic"
                                  title={<FormattedMessage id="app.max.current" defaultMessage="Current Max" />}
                                  value={this.props.intl.formatMessage({ id: selfCurrentMaxRank.name })}
                                />
                              </Col>
                              <Col className="BattlesStatisticsWindow-content-column" span={12}>
                                <Statistic
                                  className="BattlesStatisticsWindow-content-statistic"
                                  title={<FormattedMessage id="app.max.history" defaultMessage="History Max" />}
                                  value={this.props.intl.formatMessage({ id: selfMaxRank.name })}
                                />
                              </Col>
                            </Row>
                          </Card>
                        </Col>
                      );
                    }
                  })()}
                  <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                    <StatisticsCard
                      title={<FormattedMessage id="player.paint" defaultMessage="Ink" />}
                      total={selfPaint}
                      average={(selfPaint / data.length).toFixed(2)}
                      max={selfMaxPaint}
                    />
                  </Col>
                  <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                    <StatisticsCard
                      title={<FormattedMessage id="player.kill_and_assist" defaultMessage="Splat + Assist" />}
                      total={selfKillAndAssist}
                      average={(selfKillAndAssist / data.length).toFixed(2)}
                      max={selfMaxKillAndAssist}
                    />
                  </Col>
                  <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                    <StatisticsCard
                      title={<FormattedMessage id="player.kill" defaultMessage="Splat" />}
                      total={selfKill}
                      average={(selfKill / data.length).toFixed(2)}
                      max={selfMaxKill}
                    />
                  </Col>
                  <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                    <StatisticsCard
                      title={<FormattedMessage id="player.assist" defaultMessage="Assist" />}
                      total={selfAssist}
                      average={(selfAssist / data.length).toFixed(2)}
                      max={selfMaxAssist}
                    />
                  </Col>
                  <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                    <StatisticsCard
                      title={<FormattedMessage id="player.death" defaultMessage="Crushed" />}
                      total={selfDeath}
                      average={(selfDeath / data.length).toFixed(2)}
                      max={selfMaxDeath}
                    />
                  </Col>
                  <Col className="BattlesStatisticsWindow-content-column" xs={24} sm={12} md={12} lg={12} xl={6}>
                    <StatisticsCard
                      title={<FormattedMessage id="player.special" defaultMessage="Special" />}
                      total={selfSpecial}
                      average={(selfSpecial / data.length).toFixed(2)}
                      max={selfMaxSpecial}
                    />
                  </Col>
                </Row>
                <PageHeader title={<FormattedMessage id="app.trending" defaultMessage="Trending" />} />
                {(() => {
                  if (rankedChartData.length > 0) {
                    return (
                      <Row gutter={16}>
                        <Col className="BattlesStatisticsWindow-content-column" md={24} lg={12}>
                          <Card
                            className="BattlesStatisticsWindow-content-card"
                            hoverable
                            title={<FormattedMessage id="battle.power.ranked" defaultMessage="Power Level" />}
                            bodyStyle={{ padding: '16px 10px', minHeight: '170px' }}
                          >
                            <Chart
                              data={rankedChartData}
                              scale={{
                                number: { range: [0, 1] }
                              }}
                              height={200}
                              padding={[0, 6]}
                              forceFit
                            >
                              <Axis />
                              <Tooltip
                                crosshairs={{
                                  type: 'y'
                                }}
                              />
                              <Geom
                                type="line"
                                position="number*estimatedRankPower"
                                tooltip={[
                                  'number*estimatedRankPower',
                                  (number, estimatedRankPower) => {
                                    return {
                                      name: this.props.intl.formatMessage({
                                        id: 'battle.power.ranked',
                                        defaultMessage: 'Power Level'
                                      }),
                                      title: this.props.intl.formatMessage(
                                        {
                                          id: 'battle.id',
                                          defaultMessage: '#{id}'
                                        },
                                        { id: number }
                                      ),
                                      value: estimatedRankPower
                                    };
                                  }
                                ]}
                                size={2}
                                shape={'smooth'}
                                color="#fa8c16"
                              />
                            </Chart>
                          </Card>
                        </Col>
                        {(() => {
                          if (
                            rankedChartData.some(element => {
                              return element.xPower !== undefined;
                            })
                          ) {
                            return (
                              <Col className="BattlesStatisticsWindow-content-column" md={24} lg={12}>
                                <Card
                                  className="BattlesStatisticsWindow-content-card"
                                  hoverable
                                  title={<FormattedMessage id="battle.power.x" defaultMessage="X Power" />}
                                  bodyStyle={{ padding: '16px 10px', minHeight: '170px' }}
                                >
                                  <Chart
                                    data={rankedChartData}
                                    scale={{
                                      number: { range: [0, 1] }
                                    }}
                                    height={200}
                                    padding={[0, 6]}
                                    forceFit
                                  >
                                    <Axis />
                                    <Tooltip
                                      crosshairs={{
                                        type: 'y'
                                      }}
                                    />
                                    <Geom
                                      type="line"
                                      position="number*xPower"
                                      tooltip={[
                                        'number*xPower',
                                        (number, estimatedRankPower) => {
                                          return {
                                            name: this.props.intl.formatMessage({
                                              id: 'battle.power.x',
                                              defaultMessage: 'X Powere'
                                            }),
                                            title: this.props.intl.formatMessage(
                                              {
                                                id: 'battle.id',
                                                defaultMessage: '#{id}'
                                              },
                                              { id: number }
                                            ),
                                            value: xPower
                                          };
                                        }
                                      ]}
                                      size={2}
                                      shape={'smooth'}
                                      color="#fa8c16"
                                    />
                                  </Chart>
                                </Card>
                              </Col>
                            );
                          }
                        })()}
                      </Row>
                    );
                  }
                })()}
                {(() => {
                  if (teamLeaguePowerChartData.length > 0) {
                    return (
                      <Row gutter={16}>
                        <Col className="BattlesStatisticsWindow-content-column" md={24} lg={12}>
                          <Card
                            className="BattlesStatisticsWindow-content-card"
                            hoverable
                            title={
                              <FormattedMessage id="battle.power.league.team" defaultMessage="Team League Power" />
                            }
                            bodyStyle={{ padding: '16px 10px', minHeight: '170px' }}
                          >
                            <Chart
                              data={teamLeaguePowerChartData}
                              scale={{
                                number: { range: [0, 1] }
                              }}
                              height={200}
                              padding={[0, 6]}
                              forceFit
                            >
                              <Axis />
                              <Tooltip
                                crosshairs={{
                                  type: 'y'
                                }}
                              />
                              <Geom
                                type="line"
                                position="number*estimatedLeaguePoint"
                                tooltip={[
                                  'group*number*estimatedLeaguePoint',
                                  (group, number, estimatedLeaguePoint) => {
                                    switch (group) {
                                      case '1':
                                        return {
                                          name: this.props.intl.formatMessage({
                                            id: 'battle.power.league.my',
                                            defaultMessage: 'My Team League Power'
                                          }),
                                          title: this.props.intl.formatMessage(
                                            {
                                              id: 'battle.id',
                                              defaultMessage: '#{id}'
                                            },
                                            { id: number }
                                          ),
                                          value: estimatedLeaguePoint
                                        };
                                      case '2':
                                        return {
                                          name: this.props.intl.formatMessage({
                                            id: 'battle.power.league.other',
                                            defaultMessage: 'Other Team League Power'
                                          }),
                                          title: this.props.intl.formatMessage(
                                            {
                                              id: 'battle.id',
                                              defaultMessage: '#{id}'
                                            },
                                            { id: number }
                                          ),
                                          value: estimatedLeaguePoint
                                        };
                                      default:
                                        throw new RangeError();
                                    }
                                  }
                                ]}
                                size={2}
                                shape={'smooth'}
                                color={['group', ['#eb2f96', '#52c41a']]}
                              />
                            </Chart>
                          </Card>
                        </Col>
                        {(() => {
                          if (
                            leaguePowerChartData.some(element => {
                              return element.leaguePoint !== undefined;
                            })
                          ) {
                            return (
                              <Col className="BattlesStatisticsWindow-content-column" md={24} lg={12}>
                                <Card
                                  className="BattlesStatisticsWindow-content-card"
                                  hoverable
                                  title={<FormattedMessage id="battle.power.league" defaultMessage="League Power" />}
                                  bodyStyle={{ padding: '16px 10px', minHeight: '170px' }}
                                >
                                  <Chart
                                    data={leaguePowerChartData}
                                    scale={{
                                      number: { range: [0, 1] }
                                    }}
                                    height={200}
                                    padding={[0, 6]}
                                    forceFit
                                  >
                                    <Axis />
                                    <Tooltip
                                      crosshairs={{
                                        type: 'y'
                                      }}
                                    />
                                    <Geom
                                      type="line"
                                      position="number*leaguePoint"
                                      tooltip={[
                                        'group*number*leaguePoint',
                                        (group, number, leaguePoint) => {
                                          switch (group) {
                                            case '1':
                                              return {
                                                name: this.props.intl.formatMessage({
                                                  id: 'battle.power.league.current',
                                                  defaultMessage: 'Current League Power'
                                                }),
                                                title: this.props.intl.formatMessage(
                                                  {
                                                    id: 'battle.id',
                                                    defaultMessage: '#{id}'
                                                  },
                                                  { id: number }
                                                ),
                                                value: leaguePoint
                                              };
                                            case '2':
                                              return {
                                                name: this.props.intl.formatMessage({
                                                  id: 'battle.power.league.highest',
                                                  defaultMessage: 'Highest League Power'
                                                }),
                                                title: this.props.intl.formatMessage(
                                                  {
                                                    id: 'battle.id',
                                                    defaultMessage: '#{id}'
                                                  },
                                                  { id: number }
                                                ),
                                                value: leaguePoint
                                              };
                                            default:
                                              throw new RangeError();
                                          }
                                        }
                                      ]}
                                      size={2}
                                      shape={'smooth'}
                                      color={['group', ['#fa8c16', '#eb2f96']]}
                                    />
                                  </Chart>
                                </Card>
                              </Col>
                            );
                          }
                        })()}
                      </Row>
                    );
                  }
                })()}
                {(() => {
                  if (teamSplatfestPowerChartData.length > 0) {
                    return (
                      <Row gutter={16}>
                        <Col className="BattlesStatisticsWindow-content-column" md={24} lg={12}>
                          <Card
                            className="BattlesStatisticsWindow-content-card"
                            hoverable
                            title={
                              <FormattedMessage
                                id="battle.power.splatfest.team"
                                defaultMessage="Team Splatfest Power"
                              />
                            }
                            bodyStyle={{ padding: '16px 10px', minHeight: '170px' }}
                          >
                            <Chart
                              data={teamSplatfestPowerChartData}
                              scale={{
                                number: { range: [0, 1] }
                              }}
                              height={200}
                              padding={[0, 6]}
                              forceFit
                            >
                              <Axis />
                              <Tooltip
                                crosshairs={{
                                  type: 'y'
                                }}
                              />
                              <Geom
                                type="line"
                                position="number*estimatedSplatfestPower"
                                tooltip={[
                                  'group*number*estimatedSplatfestPower',
                                  (group, number, estimatedSplatfestPower) => {
                                    switch (group) {
                                      case '1':
                                        return {
                                          name: this.props.intl.formatMessage({
                                            id: 'battle.power.splatfest.my',
                                            defaultMessage: 'My Team Splatfest Power'
                                          }),
                                          title: this.props.intl.formatMessage(
                                            {
                                              id: 'battle.id',
                                              defaultMessage: '#{id}'
                                            },
                                            { id: number }
                                          ),
                                          value: estimatedSplatfestPower
                                        };
                                      case '2':
                                        return {
                                          name: this.props.intl.formatMessage({
                                            id: 'battle.power.splatfest.other',
                                            defaultMessage: 'Other Team Splatfest Power'
                                          }),
                                          title: this.props.intl.formatMessage(
                                            {
                                              id: 'battle.id',
                                              defaultMessage: '#{id}'
                                            },
                                            { id: number }
                                          ),
                                          value: estimatedSplatfestPower
                                        };
                                      default:
                                        throw new RangeError();
                                    }
                                  }
                                ]}
                                size={2}
                                shape={'smooth'}
                                color={['group', ['#eb2f96', '#52c41a']]}
                              />
                            </Chart>
                          </Card>
                        </Col>
                        {(() => {
                          if (
                            splatfestPowerChartData.some(element => {
                              return element.splatfestPower !== undefined;
                            })
                          ) {
                            return (
                              <Col className="BattlesStatisticsWindow-content-column" md={24} lg={12}>
                                <Card
                                  className="BattlesStatisticsWindow-content-card"
                                  hoverable
                                  title={
                                    <FormattedMessage id="battle.power.splatfest" defaultMessage="Splatfest Power" />
                                  }
                                  bodyStyle={{ padding: '16px 10px', minHeight: '170px' }}
                                >
                                  <Chart
                                    data={splatfestPowerChartData}
                                    scale={{
                                      number: { range: [0, 1] }
                                    }}
                                    height={200}
                                    padding={[0, 6]}
                                    forceFit
                                  >
                                    <Axis />
                                    <Tooltip
                                      crosshairs={{
                                        type: 'y'
                                      }}
                                    />
                                    <Geom
                                      type="line"
                                      position="number*splatfestPower"
                                      tooltip={[
                                        'group*number*splatfestPower',
                                        (group, number, splatfestPower) => {
                                          switch (group) {
                                            case '1':
                                              return {
                                                name: this.props.intl.formatMessage({
                                                  id: 'battle.power.splatfest.current',
                                                  defaultMessage: 'Current Splatfest Power'
                                                }),
                                                title: this.props.intl.formatMessage(
                                                  {
                                                    id: 'battle.id',
                                                    defaultMessage: '#{id}'
                                                  },
                                                  { id: number }
                                                ),
                                                value: splatfestPower
                                              };
                                            case '2':
                                              return {
                                                name: this.props.intl.formatMessage({
                                                  id: 'battle.power.splatfest.highest',
                                                  defaultMessage: 'Highest Splatfest Power'
                                                }),
                                                title: this.props.intl.formatMessage(
                                                  {
                                                    id: 'battle.id',
                                                    defaultMessage: '#{id}'
                                                  },
                                                  { id: number }
                                                ),
                                                value: splatfestPower
                                              };
                                            default:
                                              throw new RangeError();
                                          }
                                        }
                                      ]}
                                      size={2}
                                      shape={'smooth'}
                                      color={['group', ['#fa8c16', '#eb2f96']]}
                                    />
                                  </Chart>
                                </Card>
                              </Col>
                            );
                          }
                        })()}
                      </Row>
                    );
                  }
                })()}
              </div>
            );
          }
        })()}
      </div>
    );
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorResult
          error={this.state.errorLog}
          checklist={[
            <FormattedMessage
              key="network"
              id="app.problem.troubleshoot.network"
              defaultMessage="Your network connection"
            />,
            <FormattedMessage key="cookie" id="app.problem.troubleshoot.cookie" defaultMessage="Your SplatNet cookie" />
          ]}
          extra={[
            [
              <Button key="retry" onClick={this.updateBattles} type="primary">
                <FormattedMessage id="app.retry" defaultMessage="Retry" />
              </Button>,
              <Link to="/settings" key="toSettings">
                <Button type="default">
                  <FormattedMessage id="app.to_settings" defaultMessage="To Settings" />
                </Button>
              </Link>,
              <Button
                key="continue"
                onClick={() => {
                  this.setState({ error: false, loaded: true });
                }}
                type="default"
              >
                <FormattedMessage id="app.continue" defaultMessage="Continue" />
              </Button>
            ]
          ]}
        />
      );
    } else {
      return (
        <WindowLayout icon={icon} title={<FormattedMessage id="app.battles" defaultMessage="Battles" />}>
          {(() => {
            if (!this.state.loaded) {
              if (this.state.updateTotal === 0) {
                return (
                  <LoadingResult
                    description={
                      <FormattedMessage
                        id="app.result.loading.description.check_update_data"
                        defaultMessage="Takos is checking for updated data, which will last for a few seconds to a few minutes..."
                      />
                    }
                  />
                );
              } else if (this.state.updateCurrent > this.state.updateTotal) {
                return <LoadingResult />;
              } else {
                return (
                  <LoadingResult
                    description={
                      <FormattedMessage
                        id="app.result.loading.description.update_data"
                        defaultMessage="Takos is updating data {current}/{total}, which will last for a few seconds to a few minutes..."
                        values={{
                          current: this.state.updateCurrent,
                          total: this.state.updateTotal
                        }}
                      />
                    }
                  />
                );
              }
            } else {
              return this.renderContent();
            }
          })()}
        </WindowLayout>
      );
    }
  }

  componentDidMount() {
    this.updateBattles();
  }

  componentDidUpdate(prevProps, prevState) {
    let search = null;
    if (this.props.location.search !== '') {
      search = queryString.parse(this.props.location.search);
    }
    if (this.props.location.search !== prevProps.location.search) {
      this.setState({ search: search });
    }
    if (this.state.loaded !== prevState.loaded && this.state.loaded === false) {
      this.updateBattles();
    }
  }
}

export default injectIntl(BattlesStatisticsWindow);
