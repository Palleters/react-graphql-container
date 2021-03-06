// @flow
import React from 'react';
import {mount} from 'enzyme';
import {SynchronousPromise} from 'synchronous-promise';

import GraphQLContainer from '../GraphQLContainer';

describe('GraphQLContainer', () => {

  it('adds "data.loading" property to component', () => {
    const client = getGraphQL();
    const Container = getContainer();
    const component = mount(<Container data="foo" />, {context: {graphQL: {client}}});

    const {data: {loading}} = component.find('div').props();

    expect(loading).toBe(false);
  });

  it('adds graphql response to container "data" property', () => {
    const client = {
      query: jest.fn((query, data) => SynchronousPromise.resolve({data: {response: 'Test response'}})),
    };
    const Container = getContainer({query: 'test'});
    const component = mount(<Container data="foo" />, {context: {graphQL: {client}}});

    const {data: {loading, response}} = component.find('div').props();

    expect(loading).toBe(false);
    expect(response).toBe('Test response');
  });

  it('accepts "variables" function that builds variables passed to graphql', () => {
    const client = getGraphQL();
    const Container = getContainer({
      query: 'test',
      variables: (props) => ({...props, foo: 'bar'})
    });

    mount(<Container bar="baz" />, {context: {graphQL: {client}}});

    expect(client.query.mock.calls[0][1]).toEqual(expect.objectContaining({
      foo: 'bar', bar: 'baz'
    }));
  });

  it('passes mutation function as prop', () => {
    const Component = (props) => (<div data={props.data} />);

    const client = getGraphQL();
    const Container = GraphQLContainer(props => {
      return <Component {...props} />;
    }, {mutations: {
      testMutation: 'test'
    }});
    const component = mount(<Container />, {context: {graphQL: {client}}});

    component.find('Component').props().testMutation('arg');

    expect(client.query.mock.calls[0]).toEqual(['test', 'arg']);
  });

  it('transforms data from mutation response to props', () => {
    const Component = (props) => (<div data={props.data} />);
    const client = getGraphQL();
    const Container = GraphQLContainer(props => (<Component {...props} />), {
      mutations: {
        testMutation: {
          query: 'test',
          transform: (props, response) => {
            return {...props.data, ...response};
          }
        }
      }
    });
    const component = mount(<Container />, {context: {graphQL: {client}}});

    component.find('Component').props().testMutation({item1: 'item1', item2: 'item2'});

    expect(component.find('div').props()).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        item1: 'item1', item2: 'item2'
      })
    }));
  });

  describe('when updating component props multiple times', () => {
    describe('when query parameters do not change', () => {
      it('runs graphql query only once', () => {
        const client = getGraphQL();
        const Container = getContainer({query: 'test', variables: (props) => ({foo: 'bar'})});
        const component = mount(<Container data="foo" />, {context: {graphQL: {client}}});

        component.setProps({data: 'bar'});

        expect(client.query.mock.calls.length).toBe(1);
        expect(client.query.mock.calls[0][1]).toEqual({foo: 'bar'});
      });
    });

    describe('when subscription parameters do not change', () => {
      it('subscribes only once', () => {
        const client = getGraphQL();
        const Container = getContainer({
          subscriptions: {
            testSubscription: {query: '', variables: () => ({key: 'value'})}
          }
        });
        const component = mount(<Container data="foo" />, {context: {graphQL: {client}}});

        component.setProps({data: 'bar'});

        expect(client.subscribe.mock.calls.length).toBe(1);
        expect(client.subscribe.mock.calls[0][1]).toEqual({key: 'value'});
      });
    });

    describe('when query parameters change', () => {
      it('runs graphql query multiple times', () => {
        const client = getGraphQL();
        const Container = getContainer({query: 'test', variables: (props) => props});
        const component = mount(<Container data="foo" />, {context: {graphQL: {client}}});

        component.setProps({data: 'bar'});

        expect(client.query.mock.calls.length).toBe(2);
        expect(client.query.mock.calls[0][1]).toEqual({data: 'foo'});
        expect(client.query.mock.calls[1][1]).toEqual({data: 'bar'});
      });
    });

    describe('when subscription parameters change', () => {
      it('resubsribes to subscription', () => {
        const client = getGraphQL();
        const Container = getContainer({
          subscriptions: {
            testSubscription: {query: '', variables: props => props}
          }
        });
        const component = mount(<Container data="foo" />, {context: {graphQL: {client}}});

        component.setProps({data: 'bar'});

        expect(client.subscribe.mock.calls.length).toBe(2);
        expect(client.unsubscribe.mock.calls.length).toBe(1);
        expect(client.subscribe.mock.calls[0][1]).toEqual({data: 'foo'});
        expect(client.subscribe.mock.calls[1][1]).toEqual({data: 'bar'});
      });
    });
  });

  it('subscribes to subscriptions on mount', () => {
    const client = getGraphQL();
    const Container = getContainer({
      subscriptions: {
        testSubscription: {query: '', variables: () => ({})}
      }
    });

    mount(<Container />, {context: {graphQL: {client}}});

    expect(client.subscribe.mock.calls.length).toBe(1);
  });

  describe('when client does not have subscriptions enabled', () => {
    it('does not subscribe container', () => {
      const client = {
        query: jest.fn((query, data) => SynchronousPromise.resolve({data})),
      };

      const Container = getContainer({
        subscriptions: {
          testSubscription: {query: '', variables: () => ({})}
        }
      });

      expect(() => {
        mount(<Container />, {context: {graphQL: {client}}});
      }).not.toThrow();
    });
  });

  it('unsubscribes from subscriptions on unmount', () => {
    const client = getGraphQL();
    const Container = getContainer({
      subscriptions: {
        testSubscription: {query: '', variables: () => ({})}
      }
    });

    const component = mount(<Container />, {context: {graphQL: {client}}});
    component.unmount();

    expect(client.unsubscribe.mock.calls.length).toBe(1);
  });

  it('handles subscription updates', () => {
    let subscriptionHandler = () => {};
    const client = getGraphQL();
    const Container = getContainer({
      subscriptions: {
        testSubscription: {query: '', variables: () => ({})}
      }
    });
    client.subscribe = (query, variables, handler) => {
      subscriptionHandler = handler;
      return '';
    };
    const component = mount(<Container />, {context: {graphQL: {client}}});

    subscriptionHandler(null, {data: 'Frame 1'});

    expect(component.find('div').props().data.testSubscription.data).toBe('Frame 1');
  });

  function getGraphQL() {
    return {
      query: jest.fn((query, data) => SynchronousPromise.resolve({data})),
      subscribe: jest.fn(() => 'id'),
      unsubscribe: jest.fn(() => undefined)
    };
  }

  function getContainer(options = {}) {
    return GraphQLContainer(props => <div data={props.data} />, options);
  };
});
