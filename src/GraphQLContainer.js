// @flow
import React from 'react';
import {shallowEqual} from './utils';

type DataTransformer = (props: Object, data: Object) => Object;

export type GraphQLSubscription = {
  query: string,
  variables: (props: Object) => Object,
  transform?: DataTransformer
};

export type GraphQLContainerOptions = {
  query?: string,
  variables?: (props: Object) => Object,
  mutations?: {[id: string]: string | {|query: string, transform: (props: Object, response: Object) => Object|}},
  subscriptions?: {[id: string]: GraphQLSubscription},
  queries?: Object
};

export default (Container: any, options: GraphQLContainerOptions = {}) => {
  return class GraphQLContainer extends React.Component {

    static contextTypes = {
      graphQL: React.PropTypes.shape({
        client: React.PropTypes.shape({
          query: React.PropTypes.func.isRequired,
          mutation: React.PropTypes.func.isRequired,
          subscribe: React.PropTypes.func.isRequired,
          unsubscribe: React.PropTypes.func.isRequired
        })
      }).isRequired
    };

    state = {
      loading: false,
      loaded: false,
      error: undefined
    };

    subscriptions = {};

    componentDidMount() {
      if (options.query) {
        this.runQueryAndSetState(options.query, this.buildVariables(options.variables, this.props));
      }

      if (options.subscriptions) {
        this.buildSubscriptions(options.subscriptions, null, this.props);
      }
    }

    componentWillReceiveProps(nextProps: Object) {
      if (options.query && this.hasVariablesChanged(options.variables, this.props, nextProps)) {
        this.runQueryAndSetState(options.query, this.buildVariables(options.variables, nextProps));
      }

      if (options.subscriptions) {
        this.buildSubscriptions(options.subscriptions, this.props, nextProps);
      }
    }

    componentWillUnmount() {
      Object.keys(this.subscriptions).forEach(key => this.unsubscribe(this.subscriptions[key]));
    }

    buildSubscriptions(subscriptions: {[key: string]: GraphQLSubscription}, prevProps: ?Object = {}, nextProps: Object) {
      Object.keys(subscriptions).forEach(key => {
        const subscription = subscriptions[key];

        if (prevProps && !this.hasVariablesChanged(subscription.variables, prevProps, nextProps)) {
          return;
        }

        // Unsubscribe from previous subscription
        if (this.subscriptions[key]) {
          this.unsubscribe(this.subscriptions[key]);
        }

        this.subscriptions[key] = this.subscribeWithProps(key, subscription, nextProps);
      });
    }

    subscribeWithProps(key: string, subscription: GraphQLSubscription, nextProps: Object) {
      const variables = this.buildVariables(subscription.variables, nextProps);
      return this.context.graphQL.client.subscribe(subscription.query, variables, (err, data) => {
        if (subscription.transform) {
          data = subscription.transform.call(null, {...this.props, data: this.state}, data);
        }

        this.setState({[key]: data});
      });
    }

    unsubscribe(id: any) {
      this.context.graphQL.client.unsubscribe(id);
    }

    buildMutations() {
      if (options.mutations) {
        const {mutations} = options;
        return (Object.keys(mutations) || []).reduce((memo, mutation) => {
          memo[mutation] = function(options) {
            return this.runMutations(mutation, options);
          }.bind(this);
          return memo;
        }, {});
      } else {
        return {};
      }
    }

    buildQueries() {
      const {queries} = options;
      if (queries) {
        return(Object.keys(queries) || []).reduce((memo, query) => {
          memo[query] = function(options) {
            return this.runQueries(query, options);
          }.bind(this);
          return memo;
        }, {});
      } else {
        return {};
      }
    }

    runMutations(name: string, variables: Object) {
      const mutation = options.mutations && options.mutations[name];

      if (mutation) {
        const query = typeof(mutation) === 'string' ? mutation : mutation.query;

        return this.runMutation(query, variables).then(this.handleResponse).then(response => {
          if (typeof(mutation.transform) === 'function') {
            const data = mutation.transform.call(null, {...this.props, data: this.state}, response);
            this.setState(data);
          }
          return response;
        });
      } else {
        return Promise.resolve({});
      }
    }

    runQueries(name: string, variables: Object) {
      const query = options.queries && options.queries[name];
      if (query) {
        return this.runQuery(query, variables).then(this.handleResponse);
      } else {
        return Promise.resolve({});
      }
    }

    handleResponse(response: Object) {
      return {
        ...response.data,
        ...(response.errors ? {errors: response.errors} : {})
      };
    }

    buildVariables(variableBuilder: ?Function, props: Object) {
      return variableBuilder && variableBuilder.call(null, props);
    }

    hasVariablesChanged(variableBuilder: ?Function, prevProps: Object, nextProps: Object) {
      const prevVars = this.buildVariables(variableBuilder, prevProps);
      const nextVars = this.buildVariables(variableBuilder, nextProps);

      return !shallowEqual(prevVars || {}, nextVars || {});
    }

    runQueryAndSetState(query: ?string, variables: ?Object = {}) {
      if (!query) {
        return;
      }

      this.setState({loading: true});
      this.runQuery(query, variables).then(response => {
        this.setState({loading: false, loaded: true, ...response.data});
      }, error => {
        // TODO: Need to cancel promise here since this may be triggered in unmounted component
        this.setState({loading: false, loaded: false, error: error});
      });
    }

    runQuery(query: ?string, variables: ?Object) {
      return this.context.graphQL.client.query(query, variables);
    }

    runMutation(mutation: ?string, variables: ?Object) {
      return this.context.graphQL.client.mutation(mutation, variables);
    }

    render() {
      return (
        <Container
          {...this.props}
          {...this.buildMutations()}
          {...this.buildQueries()}
          data={this.state}
          />
      );
    }
  };
};
