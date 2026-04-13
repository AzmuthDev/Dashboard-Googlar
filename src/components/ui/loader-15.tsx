import styled from 'styled-components';

export const Loader = () => {
  return (
    <StyledWrapper>
      <div className="loader-container">
        <svg className="snurra" width={200} height={200} viewBox="0 0 200 200">
          <defs>
            {/* Gradiente Brilhante Nativo da Google */}
            <linearGradient id="linjärGradient" gradientTransform="rotate(90)">
              <stop className="stopp1" offset="0%" />
              <stop className="stopp2" offset="33%" />
              <stop className="stopp3" offset="66%" />
              <stop className="stopp4" offset="100%" />
            </linearGradient>
            <linearGradient y2={160} x2={160} y1={40} x1={40} gradientUnits="userSpaceOnUse" id="gradient" xlinkHref="#linjärGradient" />
          </defs>
          {/* Ring 1 - Exterior */}
          <path className="halvan" d="m 164,100 c 0,-35.346224 -28.65378,-64 -64,-64 -35.346224,0 -64,28.653776 -64,64 0,35.34622 28.653776,64 64,64 35.34622,0 64,-26.21502 64,-64 0,-37.784981 -26.92058,-64 -64,-64 -37.079421,0 -65.267479,26.922736 -64,64 1.267479,37.07726 26.703171,65.05317 64,64 37.29683,-1.05317 64,-64 64,-64" />
          {/* Ring 2 - Interior */}
          <circle className="strecken" cx={100} cy={100} r={64} />
        </svg>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 2rem;

  .loader-container {
    position: relative;
    width: 80px; /* Aumentado para melhor visibilidade */
    height: 80px;
    display: flex;
    justify-content: center;
    align-items: center;
    filter: drop-shadow(0px 0px 12px rgba(66, 133, 244, 0.4)) drop-shadow(0px 0px 24px rgba(234, 67, 53, 0.3)); /* Força GLOW da Marca */
  }

  .snurra {
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: 2;
  }

  .stopp1 { stop-color: #4285F4; } /* Google Blue */
  .stopp2 { stop-color: #EA4335; } /* Google Red */
  .stopp3 { stop-color: #FBBC05; } /* Google Yellow */
  .stopp4 { stop-color: #34A853; } /* Google Green */

  .halvan {
    animation: Snurra1 10s infinite linear;
    stroke-dasharray: 180 800;
    fill: none;
    stroke: url(#gradient);
    stroke-width: 28;
    stroke-linecap: round;
  }

  .strecken {
    animation: Snurra1 3s infinite linear;
    stroke-dasharray: 26 54;
    fill: none;
    stroke: url(#gradient);
    stroke-width: 28;
    stroke-linecap: round;
  }

  @keyframes Snurra1 {
    0% {
      stroke-dashoffset: 0;
    }
    100% {
      stroke-dashoffset: -403px;
    }
  }`;

export default Loader;
