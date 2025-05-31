import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CreateRoom from './pages/CreateRoom';
import Home from './pages/Home';
import WatchMovie from './pages/WatchMovie';
import JoinRoom from './pages/JoinRoom';
import { Toaster } from "@/components/ui/sonner"

function App() {

  return (
    <Router>
      <Toaster />

      <div className="App h-screen w-screen">
        <nav className="bg-gray-800 p-4 text-white h-[8%]">
          <ul className="flex space-x-4">
            <li>
              <Link to="/" className="hover:text-gray-300">
                Home
              </Link>
            </li>
            <li>
              <Link to="/create-room" className="hover:text-gray-300">
                Create Room
              </Link>
            </li>
            <li>
              <Link to="/join-room" className="hover:text-gray-300">
                Join Room
              </Link>
            </li>
          </ul>
        </nav>

        <div className='h-[92%]'>
          <Routes>
            <Route path="/create-room" element={<CreateRoom />} />
            <Route path="/join-room" element={<JoinRoom />} />
            <Route path="/watch/:roomId" element={<WatchMovie />} />
            <Route path="/" element={<Home />} />
          </Routes>
        </div>

      </div>
    </Router>
  );
}

export default App;
