import React from "react";
import styled from "@emotion/styled";
import Header from "./components/Header/Header";
import ModeGrid from "./components/ModeGrid/ModeGrid";
import Footer from "./components/Footer/Footer";

const AppContainer = styled.div`
  background-color: #2d2d2d;
  min-height: 100vh;
  padding: 20px;
  display: flex;
  flex-direction: column;
`;

const MainContent = styled.main`
  flex: 1;
`;

function App() {
  return (
    <AppContainer>
      <Header />
      <MainContent>
        <ModeGrid />
      </MainContent>
      <Footer />
    </AppContainer>
  );
}

export default App;
