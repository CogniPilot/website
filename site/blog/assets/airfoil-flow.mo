model AirfoilFlow "2-D flow over a NACA 2412: artificial compressibility + penalization"
  parameter Integer NX = 30 "Cells along the channel";
  parameter Integer NY = 18 "Cells across the channel";
  parameter Real Lx = 4.0 "Domain length [chords]";
  parameter Real Ly = 1.5 "Domain height [chords]";
  parameter Real xle = 1.0 "Leading edge distance from inlet [chords]";
  parameter Real aoa = 8.0 "Initial/pre-simulation angle of attack [deg]";
  parameter Boolean interactive = false
    "Use live AoA motor state for the airfoil mask" annotation(Evaluate = true);
  input Real aoa_cmd(start = aoa) "Commanded angle of attack [deg]";
  parameter Real aoa_tau = 1.0 "First-order AoA motor time constant [s]";
  parameter Real U = 1.0 "Freestream speed (horizontal)";
  parameter Real nu = 0.01 "Kinematic viscosity (Re = U/nu = 100)";
  parameter Real cs = 3.0 "Artificial-compressibility wave speed";
  parameter Real qnu = 0.01 "Pressure-mode damping diffusivity";
  parameter Real tau = 0.02 "Solid penalization time constant [s]";
  parameter Real taub = 0.05 "Boundary relaxation time constant [s]";
  parameter Real mc0 = 0.02 "Initial/pre-simulation NACA max camber";
  parameter Real pc0 = 0.4 "Initial/pre-simulation NACA camber position";
  parameter Real tk0 = 0.12 "Initial/pre-simulation NACA thickness";
  input Real mc(start = mc0) "Commanded NACA max camber";
  input Real pc(start = pc0) "Commanded NACA camber position";
  input Real tk(start = tk0) "Commanded NACA thickness";
  parameter Real shape_tau = 1.0 "First-order airfoil shape actuator time constant [s]";
  parameter Real dx = Lx / NX;
  parameter Real dy = Ly / NY;
  parameter Real pi = 3.14159265359;
  parameter Real epsn = 0.6 * dy "Mask transition width, chord-normal [chords]";
  parameter Real epss = 0.8 * dx "Mask transition width, chordwise [chords]";
  parameter Real tmin = 0.6 * dy "Smooth half-thickness floor: keeps the coarse mask closed";
  Real aoa_motor(start = aoa, fixed = true) "Lagged physical angle of attack [deg]";
  Real mc_motor(start = mc0, fixed = true) "Lagged NACA max camber";
  Real pc_motor(start = pc0, fixed = true) "Lagged NACA camber position";
  Real tk_motor(start = tk0, fixed = true) "Lagged NACA thickness";
  Real u[NX, NY] "x-velocity";
  Real v[NX, NY] "y-velocity";
  Real q[NX, NY] "pressure / rho";
  Real sc[NX, NY] "Chordwise coordinate in the pitched airfoil frame";
  Real nc[NX, NY] "Chord-normal coordinate in the pitched airfoil frame";
  Real sig[NX, NY] "Solid mask (1 inside the airfoil)";
  // States start at rest (default start = 0): an impulsive wind-tunnel
  // start where the freestream sweeps in through the boundary relaxation.
equation
  der(aoa_motor) =
    if interactive then (aoa_cmd - aoa_motor) / aoa_tau else 0.0;
  der(mc_motor) = if interactive then (mc - mc_motor) / shape_tau else 0.0;
  der(pc_motor) = if interactive then (pc - pc_motor) / shape_tau else 0.0;
  der(tk_motor) = if interactive then (tk - tk_motor) / shape_tau else 0.0;
  for i in 1:NX loop
    for j in 1:NY loop
      if interactive then
        sc[i, j] = ((i - 0.5) * dx - xle) * cos(aoa_motor * pi / 180.0)
          - ((j - 0.5) * dy - Ly / 2.0) * sin(aoa_motor * pi / 180.0);
        nc[i, j] = ((i - 0.5) * dx - xle) * sin(aoa_motor * pi / 180.0)
          + ((j - 0.5) * dy - Ly / 2.0) * cos(aoa_motor * pi / 180.0);
        sig[i, j] =
          0.5 * (1.0 - tanh((abs(nc[i, j]
              - (if sc[i, j] < pc_motor then mc_motor / pc_motor ^ 2 * (2.0 * pc_motor * sc[i, j] - sc[i, j] ^ 2)
                 else mc_motor / (1.0 - pc_motor) ^ 2
                   * ((1.0 - 2.0 * pc_motor) + 2.0 * pc_motor * sc[i, j] - sc[i, j] ^ 2)))
            - sqrt((5.0 * tk_motor * (0.2969 * sqrt(max(sc[i, j], 0.0)) - 0.1260 * sc[i, j]
                    - 0.3516 * sc[i, j] ^ 2 + 0.2843 * sc[i, j] ^ 3
                    - 0.1036 * sc[i, j] ^ 4)) ^ 2 + tmin ^ 2)) / epsn))
          * (0.5 * (1.0 + tanh(sc[i, j] / epss)))
          * (0.5 * (1.0 + tanh((1.0 - sc[i, j]) / epss)));
      else
        sc[i, j] = ((i - 0.5) * dx - xle) * cos(aoa * pi / 180.0)
          - ((j - 0.5) * dy - Ly / 2.0) * sin(aoa * pi / 180.0);
        nc[i, j] = ((i - 0.5) * dx - xle) * sin(aoa * pi / 180.0)
          + ((j - 0.5) * dy - Ly / 2.0) * cos(aoa * pi / 180.0);
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
      end if;
    end for;
  end for;
  // Interior: momentum + artificial-compressibility continuity.
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
  // Inlet (left): horizontal freestream; pressure zero-gradient.
  for j in 1:NY loop
    der(u[1, j]) = (U - u[1, j]) / taub;
    der(v[1, j]) = (0.0 - v[1, j]) / taub;
    der(q[1, j]) = (q[2, j] - q[1, j]) / taub;
    // Outlet (right): zero-gradient velocities, reference pressure.
    der(u[NX, j]) = (u[NX - 1, j] - u[NX, j]) / taub;
    der(v[NX, j]) = (v[NX - 1, j] - v[NX, j]) / taub;
    der(q[NX, j]) = (0.0 - q[NX, j]) / taub;
  end for;
  // Far field (top/bottom): freestream; pressure zero-gradient.
  for i in 2:NX - 1 loop
    der(u[i, 1]) = (U - u[i, 1]) / taub;
    der(v[i, 1]) = (0.0 - v[i, 1]) / taub;
    der(q[i, 1]) = (q[i, 2] - q[i, 1]) / taub;
    der(u[i, NY]) = (U - u[i, NY]) / taub;
    der(v[i, NY]) = (0.0 - v[i, NY]) / taub;
    der(q[i, NY]) = (q[i, NY - 1] - q[i, NY]) / taub;
  end for;
  // Interval controls the output/readback cadence; __rumoca(Solver(FixedStep))
  // controls the internal fixed-step RK4 step. CFL note: the explicit step must
  // stay below the acoustic/diffusive limit ~ 1 / (cs/h + 2*nu/h^2) with
  // h = min(dx, dy); if you refine NX/NY, drop FixedStep roughly in proportion
  // or the run will diverge.
  annotation(__rumoca(Solver(FixedStep = 0.005)), experiment(StopTime = 30, Interval = 0.1, Solver = "rk-like"));
end AirfoilFlow;
