import { Link } from 'react-router-dom';

function Home() {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-100">
        <h1 className="lg:text-4xl font-bold mb-6 text-center">Welcome to MovieByte!</h1>
        <Link
          to="/create-room"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded"
        >
          Create a Room
        </Link>
      </div>
    );
  }

  export default Home;