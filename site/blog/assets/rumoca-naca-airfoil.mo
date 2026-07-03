model AirfoilFlowBlog "Small 2-D flow over a NACA 2412 airfoil for pinned blog runtime"
  parameter Integer NX = 16 "Cells along the channel";
  parameter Integer NY = 10 "Cells across the channel";
  parameter Real Lx = 4.0 "Domain length [chords]";
  parameter Real Ly = 1.5 "Domain height [chords]";
  parameter Real xle = 1.0 "Leading edge distance from inlet [chords]";
  parameter Real aoa = 8.0 "Initial/pre-simulation angle of attack [deg]";
  parameter Boolean interactive = false
    "Use live AoA motor state for the airfoil mask" annotation(Evaluate = true);
  input Real aoa_cmd(start = aoa) "Commanded angle of attack [deg]";
  parameter Real aoa_tau = 1.0 "First-order AoA motor time constant [s]";
  parameter Real U = 1.0 "Freestream speed";
  parameter Real nu = 0.01 "Kinematic viscosity";
  parameter Real cs = 3.0 "Artificial-compressibility wave speed";
  parameter Real qnu = 0.01 "Pressure-mode damping diffusivity";
  parameter Real tau = 0.02 "Solid penalization time constant [s]";
  parameter Real taub = 0.05 "Boundary relaxation time constant [s]";
  parameter Real mc0 = 0.02 "NACA max camber";
  parameter Real pc0 = 0.4 "NACA camber position";
  parameter Real tk0 = 0.12 "NACA thickness";
  parameter Real dx = Lx / NX;
  parameter Real dy = Ly / NY;
  parameter Real pi = 3.14159265359;
  parameter Real epsn = 0.6 * dy "Mask transition width, chord-normal";
  parameter Real epss = 0.8 * dx "Mask transition width, chordwise";
  parameter Real tmin = 0.6 * dy "Smooth half-thickness floor";
  Real aoa_motor(start = aoa, fixed = true) "Lagged physical angle of attack [deg]";
  Real u[NX, NY] "x-velocity";
  Real v[NX, NY] "y-velocity";
  Real q[NX, NY] "pressure / rho";
  Real sc[NX, NY] "Chordwise coordinate in pitched airfoil frame";
  Real nc[NX, NY] "Chord-normal coordinate in pitched airfoil frame";
  Real sig[NX, NY] "Smooth solid mask";
equation
  der(aoa_motor) =
    if interactive then (aoa_cmd - aoa_motor) / aoa_tau else 0.0;

  for i in 1:NX loop
    for j in 1:NY loop
      if interactive then
        sc[i, j] = ((i - 0.5) * dx - xle) * cos(aoa_motor * pi / 180.0)
          - ((j - 0.5) * dy - Ly / 2.0) * sin(aoa_motor * pi / 180.0);
        nc[i, j] = ((i - 0.5) * dx - xle) * sin(aoa_motor * pi / 180.0)
          + ((j - 0.5) * dy - Ly / 2.0) * cos(aoa_motor * pi / 180.0);
      else
        sc[i, j] = ((i - 0.5) * dx - xle) * cos(aoa * pi / 180.0)
          - ((j - 0.5) * dy - Ly / 2.0) * sin(aoa * pi / 180.0);
        nc[i, j] = ((i - 0.5) * dx - xle) * sin(aoa * pi / 180.0)
          + ((j - 0.5) * dy - Ly / 2.0) * cos(aoa * pi / 180.0);
      end if;
      sig[i, j] =
        0.5 * (1.0 - tanh((abs(nc[i, j]
            - (if sc[i, j] < pc0 then mc0 / pc0 ^ 2 * (2.0 * pc0 * sc[i, j] - sc[i, j] ^ 2)
               else mc0 / (1.0 - pc0) ^ 2
                 * ((1.0 - 2.0 * pc0) + 2.0 * pc0 * sc[i, j] - sc[i, j] ^ 2)))
          - sqrt((5.0 * tk0 * (0.2969 * sqrt(max(sc[i, j], 0.0)) - 0.1260 * sc[i, j]
                  - 0.3516 * sc[i, j] ^ 2 + 0.2843 * sc[i, j] ^ 3
                  - 0.1036 * sc[i, j] ^ 4)) ^ 2 + tmin ^ 2)) / epsn))
        * (0.5 * (1.0 + tanh(sc[i, j] / epss)))
        * (0.5 * (1.0 + tanh((1.0 - sc[i, j]) / epss)));
    end for;
  end for;

  for i in 2:NX - 1 loop
    for j in 2:NY - 1 loop
      der(u[i, j]) = -u[i, j] * (u[i + 1, j] - u[i - 1, j]) / (2.0 * dx)
        - v[i, j] * (u[i, j + 1] - u[i, j - 1]) / (2.0 * dy)
        - (q[i + 1, j] - q[i - 1, j]) / (2.0 * dx)
        + nu * ((u[i + 1, j] - 2.0 * u[i, j] + u[i - 1, j]) / dx ^ 2
              + (u[i, j + 1] - 2.0 * u[i, j] + u[i, j - 1]) / dy ^ 2)
        - sig[i, j] * u[i, j] / tau;
      der(v[i, j]) = -u[i, j] * (v[i + 1, j] - v[i - 1, j]) / (2.0 * dx)
        - v[i, j] * (v[i, j + 1] - v[i, j - 1]) / (2.0 * dy)
        - (q[i, j + 1] - q[i, j - 1]) / (2.0 * dy)
        + nu * ((v[i + 1, j] - 2.0 * v[i, j] + v[i - 1, j]) / dx ^ 2
              + (v[i, j + 1] - 2.0 * v[i, j] + v[i, j - 1]) / dy ^ 2)
        - sig[i, j] * v[i, j] / tau;
      der(q[i, j]) = -cs ^ 2 * ((u[i + 1, j] - u[i - 1, j]) / (2.0 * dx)
                              + (v[i, j + 1] - v[i, j - 1]) / (2.0 * dy))
        + qnu * ((q[i + 1, j] - 2.0 * q[i, j] + q[i - 1, j]) / dx ^ 2
               + (q[i, j + 1] - 2.0 * q[i, j] + q[i, j - 1]) / dy ^ 2);
    end for;
  end for;

  for j in 1:NY loop
    der(u[1, j]) = (U - u[1, j]) / taub;
    der(v[1, j]) = (0.0 - v[1, j]) / taub;
    der(q[1, j]) = (q[2, j] - q[1, j]) / taub;
    der(u[NX, j]) = (u[NX - 1, j] - u[NX, j]) / taub;
    der(v[NX, j]) = (v[NX - 1, j] - v[NX, j]) / taub;
    der(q[NX, j]) = (0.0 - q[NX, j]) / taub;
  end for;

  for i in 2:NX - 1 loop
    der(u[i, 1]) = (U - u[i, 1]) / taub;
    der(v[i, 1]) = (0.0 - v[i, 1]) / taub;
    der(q[i, 1]) = (q[i, 2] - q[i, 1]) / taub;
    der(u[i, NY]) = (U - u[i, NY]) / taub;
    der(v[i, NY]) = (0.0 - v[i, NY]) / taub;
    der(q[i, NY]) = (q[i, NY - 1] - q[i, NY]) / taub;
  end for;

  annotation(__rumoca(Solver(FixedStep = 0.005)), experiment(StopTime = 0.2, Interval = 0.1, Solver = "rk-like"));
end AirfoilFlowBlog;
