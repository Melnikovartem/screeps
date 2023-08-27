from scipy import integrate
from math import floor, ceil

def energy_per_life(work, cap, move, avg_move):
    cap *= 50
    def f(dist):
        return 1400 * cap / (dist * 2 * avg_move + cap / work) 
    return f
    
def delivery_per_energy(work, cap, move, avg_move):
    cap *= 50
    def f(dist):
        return (1400 * cap / (dist * 2 * avg_move + cap / work)) / (work * 100 + 50 * cap + 50 * move)
    return f

best = []
def check_option(ref, work, cap, move, min_dist, max_dist, avg_move = 1):
    global best
    if work <= 0 or move <= 0 or cap <= 0:
        return 0
    if move * 2 < work + cap:
        avg_move *= 2
    if move < work:
        avg_move *= 1.5
    integral_delivery = integrate.quad(delivery_per_energy(work, cap, move, avg_move), min_dist, max_dist)[0]
    energy_delivery = integrate.quad(energy_per_life(work, cap, move, avg_move), min_dist, max_dist)[0]

    metric = energy_delivery * 5 + integral_delivery

    # print(f"checking {ref} : {work}/{cap}/{move} : {metric} ")
    if not len(best) or metric > best[0]:
        best = [metric, ref, work, cap, move]
    
    return metric

for min_dist in [0, 6, 37]: # [0, 6, 37]
    for max_dist in [10, 30, 60, 140]: # [10, 30, 60, 140]
        if max_dist <= min_dist:
            continue
        work_range = range(10, 50)
        prev = 0
        for work in work_range:
            # support only work
            move = work
            cap = min(50 - work * 2, move)
            a = check_option("only work", work, cap, move, min_dist, max_dist) # supporting roads
            if prev > a:
                break
            prev = a

        prev = 0
        for work in work_range:
            # support both
            cap = min(25 - work, work)
            move = cap + work
            b = check_option("supp both", work, cap, move, min_dist, max_dist)
            if prev > a:
                break
            prev = a

        print(f"Best from {min_dist} to {max_dist}: \t {best[1]} \t : {best[2]}/{best[3]}/{best[4]}")


print("Default 10/10/10 energy per life:", energy_per_life(10, 10, 10, 1)(15))