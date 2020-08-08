import React from 'react'
import ReactDOM from 'react-dom'
import {
  BrowserRouter,
  Route,
  Switch,
  useParams,
  useHistory,
  useLocation
} from 'react-router-dom'
import Main from './components/Main'

function App () {
  return (
    <BrowserRouter>
      <Main />
    </BrowserRouter>
  )
}

ReactDOM.render(<App />, document.getElementById('root'))
