import '@wordpress/components/build-style/style.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Gutenberg Release Monitor</h1>
        <p>Track Gutenberg release statistics and changelog data</p>
      </header>
      <main className="app-main">
        <p>Loading releases table...</p>
      </main>
    </div>
  );
}

export default App;
