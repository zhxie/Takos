import React from 'react';
import { injectIntl, FormattedMessage } from 'react-intl';
import { Layout, PageHeader, Alert, Form, Row, Col, Input, Icon, Button, Modal, Select, Tooltip, Switch } from 'antd';

import './SettingsWindow.css';
import icon from './assets/images/character-c-q-cumber.png';
import ErrorResult from './components/ErrorResult';
import TakosError from './utils/ErrorHelper';
import FileFolderUrl from './utils/FileFolderUrl';
import LoginHelper from './utils/LoginHelper';
import StorageHelper from './utils/StorageHelper';
import './utils/StringHelper';

const { Header, Content } = Layout;
const { confirm } = Modal;
const { Option } = Select;

class SettingsWindow extends React.Component {
  state = {
    // Render
    error: false,
    errorLog: 'unknown_error',
    // Automatic
    isUrl: false,
    isCookie: false,
    isValid: true,
    // Value
    cookie: '',
    language: 'en_US',
    useSimpleLists: false
  };

  constructor(props) {
    super(props);
    this.loginParameters = LoginHelper.generateParameters();
  }

  cookieOnChange = value => {
    if (this.state.cookie !== value) {
      this.setState({ cookie: value });
    }
    const re = /^[0-9A-Fa-f]{40}$/g;
    if (value === undefined) {
      this.setState({ isUrl: false, isCookie: false });
    } else if (value.includes('session_token_code=')) {
      this.setState({ isUrl: true, isCookie: false, isValid: true });
    } else if (re.test(value)) {
      this.setState({ isUrl: false, isCookie: true, isValid: true });
      StorageHelper.setCookie(value);
    } else {
      this.setState({ isUrl: false, isCookie: false });
    }
  };

  changeLanguage = value => {
    if (this.state.language !== value) {
      this.setState({ language: value });
    }
    switch (value) {
      case 'en_US':
        StorageHelper.setLanguage('en_US');
        break;
      case 'ja_JP':
        StorageHelper.setLanguage('ja_JP');
        break;
      case 'zh_CN':
        StorageHelper.setLanguage('zh_CN');
        break;
      default:
        throw RangeError();
    }
    window.location.reload();
  };

  changeUseSimpleLists = value => {
    if (this.state.useSimpleLists !== value) {
      this.setState({ useSimpleLists: value });
    }
    StorageHelper.setUseSimpleLists(value);
  };

  getSessionToken = () => {
    return LoginHelper.getSessionToken(this.loginParameters.sessionTokenCode, this.loginParameters.codeVerifier)
      .then(result => {
        if (result === null) {
          throw new RangeError();
        } else {
          StorageHelper.setSessionToken(result);
          return this.updateCookie();
        }
      })
      .catch(e => {
        Modal.error({
          title: this.props.intl.formatMessage({
            id: 'app.modal.error.get_session_token',
            defaultMessage: 'Can not update cookie'
          }),
          content: this.props.intl.formatMessage({
            id: 'app.modal.error.get_session_token.content',
            defaultMessage:
              'Your network can not be reached, or the link is expired. Please refresh the page and try again.'
          })
        });
      });
  };

  updateCookie = () => {
    return LoginHelper.getCookie(StorageHelper.sessionToken())
      .then(result => {
        if (result === null) {
          throw new RangeError();
        } else {
          this.cookieOnChange(result);
        }
      })
      .catch(() => {
        Modal.error({
          title: this.props.intl.formatMessage({
            id: 'app.modal.error.update_cookie',
            defaultMessage: 'Can not update cookie'
          }),
          content: (
            <div>
              <p style={{ margin: 0 }}>
                {this.props.intl.formatMessage({
                  id: 'app.modal.error.update_cookie.content.1',
                  defaultMessage:
                    'Your network can not be reached, or your login is expired. Please re-log in or try again.'
                })}
              </p>
              <p style={{ margin: 0 }}>
                {this.props.intl.formatMessage(
                  {
                    id: 'app.modal.error.update_cookie.content.2',
                    defaultMessage:
                      'And you can try using third-party apps like <a1>Ikas</a1>, <a2>splatnet2statink</a2>, <a3>Salmonia</a3> to get your cookie.'
                  },
                  {
                    a1: msg => <a href="https://github.com/zhxie/Ikas">{msg}</a>,
                    a2: msg => <a href="https://github.com/frozenpandaman/splatnet2statink">{msg}</a>,
                    a3: msg => <a href="https://github.com/tkgstrator/Salmonia">{msg}</a>
                  }
                )}
              </p>
            </div>
          )
        });
      });
  };

  showUpdateCookieConfirm = () => {
    const getSessionToken = this.getSessionToken;
    const updateCookie = this.updateCookie;
    if (this.state.isUrl) {
      this.loginParameters.sessionTokenCode = this.state.cookie.match(/de=(.*)&/i)[1];
      confirm({
        title: this.props.intl.formatMessage({
          id: 'app.modal.confirm.update_cookie',
          defaultMessage: 'Do you want to update cookie?'
        }),
        content: this.props.intl.formatMessage(
          {
            id: 'app.modal.confirm.update_cookie.content',
            defaultMessage:
              'Automatic cookie generation involves making a secure request to two non-Nintendo servers with minimal, non-identifying information. Please read "Security and Privacy" section in <a>README</a> carefully before you start.'
          },
          {
            a: msg => <a href="https://github.com/zhxie/takos/blob/master/README.md#security-and-privacy">{msg}</a>
          }
        ),
        onOk() {
          return getSessionToken();
        },
        onCancel() {}
      });
    } else {
      if (!StorageHelper.sessionToken()) {
        Modal.error({
          title: this.props.intl.formatMessage({
            id: 'app.modal.error.update_cookie_no_session_token',
            defaultMessage: 'Can not update cookie'
          }),
          content: this.props.intl.formatMessage({
            id: 'app.modal.error.update_cookie_no_session_token.content',
            defaultMessage: 'Takos can not update cookie unless you use automatic cookie generation.'
          })
        });
      } else {
        confirm({
          title: this.props.intl.formatMessage({
            id: 'app.modal.confirm.update_cookie',
            defaultMessage: 'Do you want to update cookie?'
          }),
          content: this.props.intl.formatMessage(
            {
              id: 'app.modal.confirm.update_cookie.content',
              defaultMessage:
                'Automatic cookie generation involves making a secure request to two non-Nintendo servers with minimal, non-identifying information. Please read "Security and Privacy" section in <a>README</a> carefully before you start.'
            },
            {
              a: msg => <a href="https://github.com/zhxie/takos/blob/master/README.md#security-and-privacy">{msg}</a>
            }
          ),
          onOk() {
            return updateCookie();
          },
          onCancel() {}
        });
      }
    }
  };

  showLogOutConfirm = () => {
    const thisHandler = this;
    confirm({
      title: this.props.intl.formatMessage({
        id: 'app.modal.confirm.log_out',
        defaultMessage: 'Do you want to log out?'
      }),
      content: this.props.intl.formatMessage({
        id: 'app.modal.confirm.log_out.content',
        defaultMessage: 'Note that when you log out, all saved data, including battles and salmon run, will be cleared.'
      }),
      okType: 'danger',
      icon: <Icon type="exclamation-circle" />,
      onOk() {
        // Will first initialize storage and then go to login while the login will initialize storage again
        StorageHelper.initializeStorage()
          .then(res => {
            if (res instanceof TakosError) {
              throw new TakosError(res.message);
            } else {
              window.location.assign('/');
            }
          })
          .catch(e => {
            if (e instanceof TakosError) {
              thisHandler.setState({ error: true, errorLog: e.message });
            } else {
              console.error(e);
              thisHandler.setState({ error: true, errorLog: 'unknown_error' });
            }
          });
      },
      onCancel() {}
    });
  };

  showClearDataConfirm = () => {
    const thisHandler = this;
    confirm({
      title: this.props.intl.formatMessage({
        id: 'app.modal.confirm.clear_data',
        defaultMessage: 'Do you want to clear data?'
      }),
      content: this.props.intl.formatMessage({
        id: 'app.modal.confirm.clear_data.content',
        defaultMessage:
          'Once the data is cleared, you will not be able to undo. It is recommended that you first export the data.'
      }),
      okType: 'danger',
      icon: <Icon type="exclamation-circle" />,
      onOk() {
        StorageHelper.clearData()
          .then(res => {
            if (res instanceof TakosError) {
              throw new TakosError(res.message);
            }
          })
          .catch(e => {
            if (e instanceof TakosError) {
              thisHandler.setState({ error: true, errorLog: e.message });
            } else {
              console.error(e);
              thisHandler.setState({ error: true, errorLog: 'unknown_error' });
            }
          });
      },
      onCancel() {}
    });
  };

  render() {
    if (this.state.error) {
      return <ErrorResult error={this.state.errorLog} />;
    } else {
      return (
        <Layout>
          <Header className="SettingsWindow-header" style={{ zIndex: 1 }}>
            <img className="SettingsWindow-header-icon" src={icon} alt="settings" />
            <p className="SettingsWindow-header-title">
              <FormattedMessage id="app.settings" defaultMessage="Settings" />
            </p>
          </Header>
          <Content className="SettingsWindow-content">
            <PageHeader title={<FormattedMessage id="app.settings.user" defaultMessage="User" />} />
            <Alert
              message={<FormattedMessage id="app.alert.warning" defaultMessage="Warning" />}
              description={
                <p style={{ margin: 0 }}>
                  <FormattedMessage
                    id="app.alert.warning.automatic_cookie_generation"
                    defaultMessage='Automatic cookie generation involves making a secure request to two non-Nintendo servers with minimal, non-identifying information. Please read "Security and Privacy" section in <a>README</a> carefully before you start.'
                    values={{
                      a: msg => (
                        <a href="https://github.com/zhxie/takos/blob/master/README.md#security-and-privacy">{msg}</a>
                      )
                    }}
                  />
                </p>
              }
              type="warning"
              showIcon
              style={{ margin: '12px 24px 0 24px', width: 'calc(100% - 48px)' }}
            />
            <Alert
              message={<FormattedMessage id="app.alert.info" defaultMessage="Info" />}
              description={
                <p style={{ margin: 0 }}>
                  <FormattedMessage
                    id="app.alert.info.use_automatic_cookie_generation"
                    defaultMessage='If you want to re-log in and use automatic cookie generation, please open <a>Nintendo Account</a> in browser, log in, right click on "Select this person", copy the link address, paste it into the text box below, and press "Update cookie".'
                    values={{
                      a: msg => (
                        <a
                          href={FileFolderUrl.NINTENDO_ACCOUNTS_AUTHORIZE.format(
                            this.loginParameters.state,
                            this.loginParameters.codeChallenge
                          )}
                        >
                          {msg}
                        </a>
                      )
                    }}
                  />
                </p>
              }
              type="info"
              showIcon
              style={{ margin: '12px 24px 0 24px', width: 'calc(100% - 48px)' }}
            />
            <Alert
              message={<FormattedMessage id="app.alert.info" defaultMessage="Info" />}
              description={
                <p style={{ margin: 0 }}>
                  <FormattedMessage
                    id="app.alert.info.switch_account"
                    defaultMessage="If you want to switch account, please log out first. Note that when you log out, all saved data, including battles and salmon run, will be cleared."
                  />
                </p>
              }
              type="info"
              showIcon
              style={{ margin: '12px 24px 0 24px', width: 'calc(100% - 48px)' }}
            />
            <Form className="SettingsWindow-content-form" labelCol={{ span: 24 }}>
              <Form.Item label={<FormattedMessage id="app.settings.user.cookie" defaultMessage="Cookie" />}>
                <Row gutter={8}>
                  <Col sm={18} md={12}>
                    <Input
                      value={this.state.cookie}
                      onChange={e => {
                        this.cookieOnChange(e.target.value);
                      }}
                      allowClear
                      prefix={(() => {
                        if (this.state.isUrl) {
                          return <Icon type="link" style={{ color: 'rgba(0,0,0,.25)' }} />;
                        } else if (this.state.isCookie) {
                          return <Icon type="user" style={{ color: 'rgba(0,0,0,.25)' }} />;
                        } else {
                          return <Icon type="edit" style={{ color: 'rgba(0,0,0,.25)' }} />;
                        }
                      })()}
                    />
                  </Col>
                  <Col span={6}>
                    <Button onClick={this.showUpdateCookieConfirm}>
                      <FormattedMessage id="app.settings.user.cookie.update" defaultMessage="Update cookie" />
                    </Button>
                  </Col>
                </Row>
              </Form.Item>
              <Form.Item label={<FormattedMessage id="app.settings.user.log_out" defaultMessage="Log Out" />}>
                <Row gutter={8}>
                  <Col>
                    <Button type="danger" onClick={this.showLogOutConfirm}>
                      <FormattedMessage id="app.settings.user.log_out" defaultMessage="Log Out" />
                    </Button>
                  </Col>
                </Row>
              </Form.Item>
            </Form>
            <PageHeader title={<FormattedMessage id="app.settings.appearance" defaultMessage="Appearance" />} />
            <Form className="SettingsWindow-content-form" labelCol={{ span: 24 }}>
              <Form.Item
                label={
                  <FormattedMessage id="app.settings.appearance.use_simple_lists" defaultMessage="Use Simple Lists" />
                }
              >
                <Row gutter={8}>
                  <Col>
                    <Tooltip
                      placement="right"
                      title={
                        <FormattedMessage
                          id="app.settings.appearance.use_simple_lists.description"
                          defaultMessage="Use simple lists in battles and Salmon Run"
                        />
                      }
                    >
                      <Switch checked={this.state.useSimpleLists} onChange={this.changeUseSimpleLists} />
                    </Tooltip>
                  </Col>
                </Row>
              </Form.Item>
              <Form.Item label={<FormattedMessage id="app.settings.appearance.language" defaultMessage="Language" />}>
                <Row gutter={8}>
                  <Col span={6}>
                    <Select
                      value={this.state.language}
                      onChange={this.changeLanguage}
                      defaultValue="en_US"
                      style={{ width: 120, margin: '0' }}
                    >
                      <Option value="en_US">English</Option>
                      <Option value="ja_JP">日本語</Option>
                      <Option value="zh_CN">中文</Option>
                    </Select>
                  </Col>
                </Row>
              </Form.Item>
            </Form>
            <PageHeader title={<FormattedMessage id="app.settings.system" defaultMessage="System" />} />
            <Form className="SettingsWindow-content-form" labelCol={{ span: 24 }}>
              <Form.Item label={<FormattedMessage id="app.settings.system.data" defaultMessage="Data" />}>
                <Row gutter={8}>
                  <Col>
                    <Button type="default" disabled>
                      <FormattedMessage id="app.settings.system.data.export" defaultMessage="Export Data" />
                    </Button>
                    <Button type="default" disabled style={{ marginLeft: '8px' }}>
                      <FormattedMessage id="app.settings.system.data.import" defaultMessage="Import Data" />
                    </Button>
                    <Button type="danger" onClick={this.showClearDataConfirm} style={{ marginLeft: '8px' }}>
                      <FormattedMessage id="app.settings.system.data.clear" defaultMessage="Clear Data" />
                    </Button>
                  </Col>
                </Row>
              </Form.Item>
            </Form>
          </Content>
        </Layout>
      );
    }
  }

  componentDidMount() {
    if (StorageHelper.cookie() !== null) {
      this.cookieOnChange(StorageHelper.cookie());
    }
    switch (StorageHelper.language()) {
      case 'en_US':
        this.setState({ language: 'en_US' });
        break;
      case 'ja_JP':
        this.setState({ language: 'ja_JP' });
        break;
      case 'zh_CN':
        this.setState({ language: 'zh_CN' });
        break;
      default:
        this.setState({ language: 'en_US' });
        break;
    }
    this.setState({ useSimpleLists: StorageHelper.useSimpleLists() });
  }
}

export default injectIntl(SettingsWindow);
