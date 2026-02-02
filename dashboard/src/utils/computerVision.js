// helper functions for projections, unprojections and distortion and undistortion of points

function multiply3x3(A, B) {
  const R = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        R[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return R;
}

function scale3x3(M, s) {
  return M.map(r => r.map(v => v * s));
}

function add3x3(A, B) {
  return A.map((r, i) => r.map((v, j) => v + B[i][j]));
}

function convertPointsToHomogeneous(points) {
  return points.map(p => [p[0], p[1], 1]);
}

function rodrigues(rvec) {
  const [rx, ry, rz] = rvec;
  const theta = Math.hypot(rx, ry, rz);

  if (theta < 1e-8) {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
  }

  const kx = rx / theta;
  const ky = ry / theta;
  const kz = rz / theta;

  const K = [
    [0, -kz, ky],
    [kz, 0, -kx],
    [-ky, kx, 0]
  ];

  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);

  // K^2
  const K2 = multiply3x3(K, K);

  const I = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ];

  return add3x3(
    add3x3(I, scale3x3(K, sinT)),
    scale3x3(K2, 1 - cosT)
  );
}

function undistortPoints(points, cameraMatrix, distCoeffs = null, iterations = 5) {
  const fx = cameraMatrix[0][0];
  const fy = cameraMatrix[1][1];
  const cx = cameraMatrix[0][2];
  const cy = cameraMatrix[1][2];

  // Normalize
  let x = points.map(p => (p[0] - cx) / fx);
  let y = points.map(p => (p[1] - cy) / fy);

  if (!distCoeffs) {
    return x.map((xi, i) => [
      fx * xi + cx,
      fy * y[i] + cy
    ]);
  }

  const [
    k1 = 0, k2 = 0, p1 = 0, p2 = 0,
    k3 = 0, k4 = 0, k5 = 0, k6 = 0
  ] = distCoeffs;

  let xu = [...x];
  let yu = [...y];

  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < xu.length; i++) {
      const r2 = xu[i] * xu[i] + yu[i] * yu[i];
      const r4 = r2 * r2;
      const r6 = r4 * r2;

      const radial =
        (1 + k1 * r2 + k2 * r4 + k3 * r6) /
        (1 + k4 * r2 + k5 * r4 + k6 * r6);

      const xt =
        2 * p1 * xu[i] * yu[i] + p2 * (r2 + 2 * xu[i] * xu[i]);
      const yt =
        p1 * (r2 + 2 * yu[i] * yu[i]) + 2 * p2 * xu[i] * yu[i];

      xu[i] = (x[i] - xt) / radial;
      yu[i] = (y[i] - yt) / radial;
    }
  }

  // Back to pixels
  return xu.map((xi, i) => [
    fx * xi + cx,
    fy * yu[i] + cy
  ]);
}

function normalizePoints(points, cameraMatrix, reverse = false) {
  const fx = cameraMatrix[0][0];
  const fy = cameraMatrix[1][1];
  const cx = cameraMatrix[0][2];
  const cy = cameraMatrix[1][2];
  if (reverse) {
    return points.map(p => {
      return [
        fx * p[0] + cx,
        fy * p[1] + cy
      ];
    });
  } else {
    return points.map(p => {
      return [(p[0] - cx) / fx, (p[1] - cy) / fy];
    })
  }
}

function projectPoints(objectPoints, rvec, tvec, cameraMatrix, distCoeffs) {
  const fx = cameraMatrix[0][0];
  const fy = cameraMatrix[1][1];
  const cx = cameraMatrix[0][2];
  const cy = cameraMatrix[1][2];

  const [
    k1 = 0, k2 = 0, p1 = 0, p2 = 0,
    k3 = 0, k4 = 0, k5 = 0, k6 = 0
  ] = distCoeffs || [];

  const isIdentity =
    rvec.every(v => Math.abs(v) < 1e-12) &&
    tvec.every(v => Math.abs(v) < 1e-12);

  let camPts;
  if (isIdentity) {
    camPts = objectPoints;
  } else {
    const R = rodrigues(rvec);
    camPts = objectPoints.map(p => [
      R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2] + tvec[0],
      R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2] + tvec[1],
      R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2] + tvec[2]
    ]);
  }

  return camPts.map(p => {
    const z = Math.abs(p[2]) < 1e-10 ? 1e-10 : p[2];
    let x = p[0] / z;
    let y = p[1] / z;

    const r2 = x * x + y * y;
    const r4 = r2 * r2;
    const r6 = r4 * r2;

    const radial =
      (1 + k1 * r2 + k2 * r4 + k3 * r6) /
      (1 + k4 * r2 + k5 * r4 + k6 * r6);

    let xd = x * radial + 2 * p1 * x * y + p2 * (r2 + 2 * x * x);
    let yd = y * radial + p1 * (r2 + 2 * y * y) + 2 * p2 * x * y;

    return [
      fx * xd + cx,
      fy * yd + cy
    ];
  });
}


function distortPoints(points, cameraMatrix, distCoeffs) {
  const undistorted = undistortPoints(points, cameraMatrix, null);
  const undistortedNorm = normalizePoints(undistorted, cameraMatrix);
  const pts3d = convertPointsToHomogeneous(undistortedNorm);

  return projectPoints(
    pts3d,
    [0, 0, 0],
    [0, 0, 0],
    cameraMatrix,
    distCoeffs
  );
}

export function projectLine(start, end, cameraMatrix, distCoeffs = null, split = 100) {
  const [p1, p2] = undistortPoints([start, end], cameraMatrix, distCoeffs);

  const line = [];
  for (let i = 0; i < split; i++) {
    const t = i / (split - 1);
    line.push([
      p1[0] * (1 - t) + p2[0] * t,
      p1[1] * (1 - t) + p2[1] * t
    ]);
  }

  return distortPoints(line, cameraMatrix, distCoeffs);
}
