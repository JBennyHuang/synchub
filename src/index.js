import React from 'react';
import ReactDOM from 'react-dom';
import Workspace from './routes/workspace/workspace';
import Signin from './routes/signin/signin'

import 'antd/dist/antd.css';

import {
  BrowserRouter as Router,
  Switch,
  Route,
} from "react-router-dom";

ReactDOM.render(
  <React.StrictMode>
    <Router>
      <Switch>
        <Route path="/signin">
          <Signin />
        </Route>
        <Route path="/">
          <Workspace />
        </Route>
      </Switch>
    </Router>
  </React.StrictMode>,
  document.getElementById('root')
);