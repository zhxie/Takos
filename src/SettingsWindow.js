import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Layout, PageHeader, Alert, Form, Row, Col, Input, Icon, Button, Modal } from 'antd';

import './SettingsWindow.css';
import { NINTENDO_ACCOUNTS_AUTHORIZE } from './utils/FileFolderUrl';
import './utils/StringHelper';
import LoginHelper from './utils/LoginHelper';
import icon from './assets/images/character-c-q-cumber.png';

const { Header, Content } = Layout;
const { confirm } = Modal;

class SettingsWindow extends React.Component {
  state = {
    isUrl: false,
    isCookie: false,
    isValid: true,
    cookie: ''
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
      window.localStorage.cookie = value;
    } else {
      this.setState({ isUrl: false, isCookie: false });
    }
  };

  getSessionToken = () => {
    return LoginHelper.getSessionToken(this.loginParameters.sessionTokenCode, this.loginParameters.codeVerifier).then(
      result => {
        if (!result) {
          Modal.error({
            title: <FormattedMessage id="app.modal.error.get_session_token" defaultMessage="Can not update cookie" />,
            content: (
              <FormattedMessage
                id="app.modal.error.get_session_token.content"
                defaultMessage="Your network can not be reached, or the link is expired, please refresh the page and try again."
              />
            )
          });
          return;
        } else {
          window.localStorage.sessionToken = result;
          return this.updateCookie();
        }
      }
    );
  };

  updateCookie = () => {
    return LoginHelper.updateCookie(window.localStorage.sessionToken).then(result => {
      if (!result) {
        Modal.error({
          title: <FormattedMessage id="app.modal.error.update_cookie" defaultMessage="Can not update cookie" />,
          content: (
            <div>
              <p style={{ margin: 0 }}>
                <FormattedMessage
                  id="app.modal.error.update_cookie.content.1"
                  defaultMessage="Your network can not be reached, or your login is expired, please re-login or try again."
                />
              </p>
              <p style={{ margin: 0 }}>
                And you can try using third-party apps like <a href="https://github.com/zhxie/Ikas">Ikas</a>,{' '}
                <a href="https://github.com/frozenpandaman/splatnet2statink">splatnet2statink</a>,{' '}
                <a href="https://github.com/tkgstrator/Salmonia">Salmonia</a> to get your cookie.
                <FormattedMessage
                  id="app.modal.error.update_cookie.content.2"
                  defaultMessage="And you can try using third-party apps like <a1>Ikas</a1>, <a2>splatnet2statink</a2>, <a3>Salmonia</a3> to get your cookie."
                  values={{
                    a1: msg => <a href="https://github.com/zhxie/Ikas">{msg}</a>,
                    a2: msg => <a href="https://github.com/frozenpandaman/splatnet2statink">{msg}</a>,
                    a3: msg => <a href="https://github.com/tkgstrator/Salmonia">{msg}</a>
                  }}
                />
              </p>
            </div>
          )
        });
      } else {
        this.cookieOnChange(result);
      }
    });
  };

  showConfirm = () => {
    const getSessionToken = this.getSessionToken;
    const updateCookie = this.updateCookie;
    if (this.state.isUrl) {
      this.loginParameters.sessionTokenCode = this.state.cookie.match(/de=(.*)&/i)[1];
      confirm({
        title: <FormattedMessage id="app.modal.confirm.update_cookie" defaultMessage="Do you want to update cookie?" />,
        content: (
          <p style={{ margin: 0 }}>
            <FormattedMessage
              id="app.modal.confirm.update_cookie.content"
              defaultMessage='Automatic cookie generation involves making a secure request to two non-Nintendo servers with minimal, non-identifying information. Please read "Security and Privacy" section in <a>README</a> carefully before you start.'
              values={{
                a: msg => <a href="https://github.com/zhxie/takos/blob/master/README.md#security-and-privacy">{msg}</a>
              }}
            />
          </p>
        ),
        onOk() {
          return getSessionToken();
        },
        onCancel() {}
      });
    } else {
      if (!window.localStorage.sessionToken) {
        Modal.error({
          title: (
            <FormattedMessage
              id="app.modal.error.update_cookie_no_session_token"
              defaultMessage="Can not update cookie"
            />
          ),
          content: (
            <FormattedMessage
              id="app.modal.error.update_cookie_no_session_token.content"
              defaultMessage="Takos can not update cookie unless you use automatic cookie generation."
            />
          )
        });
      } else {
        confirm({
          title: (
            <FormattedMessage id="app.modal.confirm.update_cookie" defaultMessage="Do you want to update cookie?" />
          ),
          content: (
            <p style={{ margin: 0 }}>
              <FormattedMessage
                id="app.modal.confirm.update_cookie.content"
                defaultMessage='Automatic cookie generation involves making a secure request to two non-Nintendo servers with minimal, non-identifying information. Please read "Security and Privacy" section in <a>README</a> carefully before you start.'
                values={{
                  a: msg => (
                    <a href="https://github.com/zhxie/takos/blob/master/README.md#security-and-privacy">{msg}</a>
                  )
                }}
              />
            </p>
          ),
          onOk() {
            return updateCookie();
          },
          onCancel() {}
        });
      }
    }
  };

  render() {
    return (
      <Layout>
        <Header className="SettingsWindow-header" style={{ zIndex: 1 }}>
          <img className="SettingsWindow-header-icon" src={icon} alt="settings" />
          <p className="SettingsWindow-header-title">
            <FormattedMessage id="app.settings" defaultMessage="Settings" />
          </p>
        </Header>
        <Content className="SettingsWindow-content">
          <PageHeader title={<FormattedMessage id="app.user" defaultMessage="User" />} />
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
                  defaultMessage='If you want to re-login, switch account and use automatic cookie generation, please open <a>Nintendo Account</a> in browser, log in, right click on "Select this person", copy the link address, paste it into the text box below, and press "Update cookie".'
                  values={{
                    a: msg => (
                      <a
                        href={NINTENDO_ACCOUNTS_AUTHORIZE.format(
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
          <Form className="SettingsWindow-content-user" labelCol={{ span: 24 }}>
            <Form.Item label={<FormattedMessage id="app.cookie" defaultMessage="Cookie" />}>
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
                  <Button onClick={this.showConfirm}>
                    <FormattedMessage id="app.cookie.update" defaultMessage="Update cookie" />
                  </Button>
                </Col>
              </Row>
            </Form.Item>
          </Form>
        </Content>
      </Layout>
    );
  }

  componentDidMount() {
    if (window.localStorage.cookie !== undefined) {
      this.cookieOnChange(window.localStorage.cookie);
    }
  }

  /*
  componentDidUpdate(prevProps) {
    if (this.state.cookie !== window.localStorage.cookie) {
      if (window.localStorage.cookie === undefined) {
        this.setState({ cookie: '' });
      } else {
        this.setState({ cookie: window.localStorage.cookie });
      }
    }
  }
  */
}

export default SettingsWindow;
