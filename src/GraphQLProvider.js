// @flow
import React from 'react';

export type GraphQLSubscriptionHandler = (errors: Array<Error>, result?: any) => void;

export interface GraphQLClient {
  query(query: string, variables?: Object): Promise<*>,
  mutation(mutation: string, variables?: Object): Promise<*>,
  subscribe(subscription: string, variables?: Object, handler: GraphQLSubscriptionHandler): ?string,
  unsubscribe(id: string): void
}

export default class GraphQLProvider extends React.Component {

  static childContextTypes = {
    graphQL: React.PropTypes.shape({
      client: React.PropTypes.shape({
        query: React.PropTypes.func.isRequired,
        mutation: React.PropTypes.func.isRequired,
        subscribe: React.PropTypes.func.isRequired,
        unsubscribe: React.PropTypes.func.isRequired
      })
    }).isRequired
  };

  props: {
    client: GraphQLClient,
    children?: React.Element<*>
  };

  getChildContext() {
    return {
      graphQL: {
        client: this.props.client
      }
    };
  }

  render() {
    return this.props.children;
  }
};
